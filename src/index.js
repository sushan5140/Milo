import 'dotenv/config'
import mineflayer from 'mineflayer'
import minecraftData from 'minecraft-data'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import { MemoryStore } from './memory.js'
import { parseIntent, supportedResources } from './agent/intent.js'
import { inventorySummary, toolClassFor } from './world/inventory.js'
import { gatherResource } from './skills/gathering.js'
import { nearestChest, serializePosition, depositItems, countStoredItems } from './skills/storage.js'
import { smeltResource } from './skills/smelting.js'
import { ensureTool } from './skills/crafting.js'
import { recoverDeathItems } from './safety/recovery.js'
import { verifyHeldGoal, verifyDepositDelta, summarizeVerification } from './agent/verifier.js'
import { withRetries } from './safety/retry.js'

const {
  MILO_HOST = 'localhost',
  MILO_PORT = '25565',
  MILO_USERNAME = 'Milo',
  MILO_VERSION = '',
  MILO_AUTH = 'offline',
  MILO_OWNER = '',
  MILO_MEMORY_FILE = './data/memory.json'
} = process.env

const bot = mineflayer.createBot({
  host: MILO_HOST,
  port: Number(MILO_PORT),
  username: MILO_USERNAME,
  auth: MILO_AUTH,
  ...(MILO_VERSION ? { version: MILO_VERSION } : {})
})

bot.loadPlugin(pathfinder)

const memory = new MemoryStore(MILO_MEMORY_FILE)
await memory.load()

let owner = MILO_OWNER || memory.get('owner.username') || ''
let mcData = null
let activeTask = null

function say(message) {
  bot.chat(message)
}

function isForMilo(message) {
  return /^milo\b/i.test(message.trim())
}

function stripWakeWord(message) {
  return message.trim().replace(/^milo[,:]?\s*/i, '').trim()
}

function posLabel(position) {
  return `${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pauseActiveTask(reason = 'priority_interrupt') {
  if (!activeTask) return null

  const snapshot = {
    id: activeTask.id,
    intent: activeTask.intent,
    reason,
    savedAt: new Date().toISOString()
  }

  activeTask.cancelled = true
  memory.set('tasks.pending', snapshot)
  memory.set('tasks.current', null)
  memory.pushEvent('task_preempted', {
    id: activeTask.id,
    resource: activeTask.resource,
    amount: activeTask.amount,
    reason
  })
  await memory.save()

  bot.pathfinder.stop()
  bot.clearControlStates()

  for (let i = 0; i < 15 && activeTask; i += 1) {
    await sleep(100)
  }

  return snapshot
}

async function goHome() {
  const home = memory.get('places.home')
  if (!home) throw new Error('HOME_UNKNOWN')
  if (home.dimension && home.dimension !== bot.game.dimension) throw new Error('HOME_OTHER_DIMENSION')
  await bot.pathfinder.goto(new goals.GoalNear(home.x, home.y, home.z, 2))
}

function friendlyError(error) {
  const message = String(error?.message || error)

  if (message.startsWith('MISSING_TOOL:')) {
    return `I need a ${message.split(':')[1]} before I can do that.`
  }
  if (message === 'CRAFTING_TABLE_MISSING') return "I need a crafting table nearby before I can make the missing gear."
  if (message.startsWith('TOOL_MATERIALS_MISSING:')) {
    const [, tool, tier] = message.split(':')
    return `I need materials for at least a ${tier} ${tool} before I can do that.`
  }
  if (message.startsWith('TOOL_CRAFT_FAILED:')) return `I couldn't craft ${message.split(':')[1]} safely.`
  if (message === 'FURNACE_MATERIALS_MISSING') return "I need 8 cobblestone and a crafting table before I can make a furnace."
  if (message === 'NO_SAFE_FURNACE_SPOT') return "I couldn't find a safe empty spot to place a furnace without touching your build."
  if (message.startsWith('SURVIVAL_CHECK_FAILED:')) {
    return `I'm not risking it yet — ${message.split(':').slice(1).join(':')}.`
  }
  if (message === 'HOME_UNKNOWN') return "I can gather it, but show me home first with 'Milo remember home'."
  if (message === 'HOME_OTHER_DIMENSION') return "home is in another dimension. cross-dimension return isn't wired yet."
  if (message === 'STORAGE_MISSING') return "the storage I remembered isn't there anymore."
  if (message === 'FURNACE_MISSING') return "I brought the ore back, but I can't find a furnace close enough yet."
  if (message === 'FUEL_MISSING') return "I found a furnace, but I don't have coal or charcoal to smelt this yet."
  if (message === 'FURNACE_BUSY') return "the nearby furnace is busy with something else, so I left it alone."
  if (message === 'SMELT_TIMEOUT') return "the furnace didn't finish normally, so I stopped instead of assuming it worked."
  if (message === 'TASK_CANCELLED') return "stopped. I won't continue that task."
  if (message === 'NO_DEATH_MEMORY') return "I don't have a recent death location to recover from."
  if (message === 'DEATH_MEMORY_STALE') return "that death was too long ago for me to treat the dropped items as recoverable."
  if (message === 'DEATH_OTHER_DIMENSION') return "my last death was in another dimension; cross-dimension recovery isn't safe yet."
  if (message === 'NO_FOOD_LOW_HEALTH') return "my health is too low and I don't have food to recover safely."
  if (message === 'NO_FOOD_LOW_HUNGER') return "I'm too hungry to continue and I don't have food."
  if (message.startsWith('CANNOT_DIG:')) return `I reached it, but I can't safely dig ${message.split(':')[1]}.`
  return "that task broke somewhere, so I stopped instead of guessing."
}

async function runGatherTask(username, intent, options = {}) {
  const { amount, resource } = intent
  const taskId = options.taskId || `gather-${Date.now()}`
  activeTask = {
    id: taskId,
    type: 'gather',
    resource: resource.canonical,
    amount,
    intent,
    resumed: Boolean(options.resumed),
    startedAt: new Date().toISOString()
  }

  memory.set('tasks.current', {
    id: activeTask.id,
    type: activeTask.type,
    resource: activeTask.resource,
    amount: activeTask.amount,
    intent: activeTask.intent,
    startedAt: activeTask.startedAt
  })
  memory.pushEvent(options.resumed ? 'task_resumed' : 'task_started', activeTask)
  await memory.save()

  say(`got it. going for ${amount} ${resource.canonical.replaceAll('_', ' ')}.`)

  try {
    const toolClass = toolClassFor(resource)
    if (!['dirt'].includes(resource.canonical)) {
      const tool = await ensureTool({ bot, mcData, toolClass, resource })
      if (tool.crafted) say(`I was missing a usable ${toolClass}, so I made a ${tool.tool.replaceAll('_', ' ')} first.`)
    }

    let result = null
    for (let planAttempt = 1; planAttempt <= 2; planAttempt += 1) {
      result = await withRetries(
        () => gatherResource({
          bot,
          mcData,
          resource,
          amount,
          onProgress: message => say(message),
          shouldCancel: () => Boolean(activeTask?.cancelled)
        }),
        {
          attempts: 2,
          onRetry: ({ code }) => say(`that route failed with ${code}. trying another way.`)
        }
      )

      if (result.complete) break
      if (activeTask?.cancelled) throw new Error('TASK_CANCELLED')
      if (planAttempt < 2) say(`I only got to ${result.total}. replanning once before I give up.`)
    }

    if (!result.complete) {
      say(`I only got to ${result.total}. I couldn't verify the full amount nearby.`)
    }

    const home = memory.get('places.home')
    if (home) {
      say('heading back.')
      await goHome()
    }

    let deliveryNames = resource.drops
    let deliveryCount = result.total
    let processed = 0

    if (resource.process === 'smelt' && result.total > 0) {
      say(`got the ore. smelting ${Math.min(amount, result.total)} now.`)
      const smelt = await withRetries(
        () => smeltResource({
          bot,
          mcData,
          inputNames: resource.drops,
          outputName: resource.finished[0],
          amount: Math.min(amount, result.total)
        }),
        {
          attempts: 2,
          delayMs: 2000,
          onRetry: ({ code }) => say(`smelting hit ${code}. retrying once.`)
        }
      )
      processed = smelt.produced
      deliveryNames = resource.finished
      deliveryCount = smelt.produced
    }

    const storage = memory.get('storage.default')
    let deposited = 0
    let verification = null

    if (storage && storage.dimension === bot.game.dimension) {
      const depositCount = Math.min(amount, deliveryCount)
      const beforeStored = await countStoredItems({ bot, storage, itemNames: deliveryNames })

      const deposit = await withRetries(
        () => depositItems({
          bot,
          storage,
          itemNames: deliveryNames,
          count: depositCount
        }),
        {
          attempts: 2,
          onRetry: ({ code }) => say(`storage step hit ${code}. retrying once.`)
        }
      )
      deposited = deposit.deposited

      const afterStored = await countStoredItems({ bot, storage, itemNames: deliveryNames })
      verification = verifyDepositDelta({
        before: beforeStored,
        after: afterStored,
        requested: amount
      })
    } else {
      verification = verifyHeldGoal(bot, deliveryNames, amount)
    }

    const outcome = {
      id: taskId,
      requested: amount,
      resource: resource.canonical,
      gathered: result.gathered,
      processed,
      totalHeld: deliveryCount,
      deposited,
      complete: Boolean(verification?.complete),
      verification,
      finishedAt: new Date().toISOString()
    }

    if (outcome.complete) {
      memory.set('tasks.pending', null)
      memory.set('tasks.current', null)
      memory.pushEvent('task_completed', outcome)
    } else {
      memory.set('tasks.pending', {
        id: taskId,
        intent,
        reason: 'verification_failed',
        verification,
        savedAt: new Date().toISOString()
      })
      memory.set('tasks.current', null)
      memory.pushEvent('task_incomplete', outcome)
    }
    await memory.save()

    if (deposited > 0 && verification?.complete) {
      say(`back. I put ${deposited} ${resource.display || resource.canonical.replaceAll('_', ' ')} in storage — ${summarizeVerification(verification)}.`)
    } else if (deposited > 0) {
      say(`I deposited some, but the goal didn't verify: ${summarizeVerification(verification)}. say 'Milo resume' and I'll continue.`)
    } else if (home) {
      say(`back home. I've got ${deliveryCount} ${resource.display || resource.canonical.replaceAll('_', ' ')} on me — show me a chest with 'Milo remember storage' and I'll use it next time.`)
    } else {
      say(`done for now. I've got ${deliveryCount} on me. you haven't shown me home yet.`)
    }
  } catch (error) {
    const reason = String(error?.message || error)
    memory.set('tasks.current', null)
    memory.set('tasks.pending', {
      id: taskId,
      intent,
      reason,
      savedAt: new Date().toISOString()
    })
    memory.pushEvent(reason === 'TASK_CANCELLED' ? 'task_paused' : 'task_failed', {
      id: taskId,
      resource: resource.canonical,
      amount,
      error: reason
    })
    await memory.save()
    console.error('[Milo] Gather task failed:', error)
    say(friendlyError(error))
    if (reason === 'TASK_CANCELLED') say("I saved the task. say 'Milo resume' whenever you want me to continue.")
  } finally {
    activeTask = null
  }
}

bot.once('spawn', async () => {
  mcData = minecraftData(bot.version)
  bot.pathfinder.setMovements(new Movements(bot, mcData))
  console.log(`[Milo] Spawned on ${MILO_HOST}:${MILO_PORT} as ${MILO_USERNAME} (${bot.version})`)
  if (owner) console.log(`[Milo] Owner: ${owner}`)
})

bot.on('chat', async (username, message) => {
  if (username === bot.username || !isForMilo(message)) return

  if (!owner) {
    owner = username
    memory.set('owner.username', username)
    await memory.save()
    say(`alright ${username}, you're my owner now.`)
  }

  if (username !== owner) {
    say(`I'm currently paired with ${owner}.`)
    return
  }

  const rawIntent = stripWakeWord(message)
  const normalized = rawIntent.toLowerCase()

  try {
    if (/^(resume|resume task|continue task|continue)$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something.")
        return
      }

      const pending = memory.get('tasks.pending')
      if (!pending?.intent) {
        say("I don't have a paused task to resume.")
        return
      }

      say(`resuming the ${pending.intent.amount} ${pending.intent.resource.display || pending.intent.resource.canonical} task.`)
      void runGatherTask(username, pending.intent, { taskId: pending.id, resumed: true })
      return
    }

    if (/^(stop|cancel|stop task|cancel task)$/.test(normalized)) {
      if (!activeTask) {
        say("I'm not doing anything right now.")
        return
      }
      activeTask.cancelled = true
      bot.pathfinder.stop()
      bot.clearControlStates()
      say("stopping.")
      return
    }

    if (/^(recover|recover items|recover my items|get my items|death recovery)$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something. stop that task first.")
        return
      }

      const death = memory.get('recovery.lastDeath')
      say("going back to my last death spot to look for dropped items.")
      const result = await recoverDeathItems({ bot, death })
      memory.pushEvent('death_recovery_attempted', {
        death,
        approached: result.approached,
        recovered: result.recovered,
        recoveredCount: result.recoveredCount,
        verified: result.verified
      })
      await memory.save()

      if (result.verified) {
        const summary = Object.entries(result.recovered)
          .slice(0, 5)
          .map(([name, count]) => `${count} ${name}`)
          .join(', ')
        say(`recovery verified. I picked up ${result.recoveredCount} items${summary ? `: ${summary}` : '.'}`)
      } else {
        say("I reached the death spot, but my inventory didn't increase, so I can't claim I recovered anything.")
      }
      return
    }

    if (/^(come|come here|follow me|help me|come help me|come here now)$/.test(normalized)) {
      const target = bot.players[username]?.entity
      if (!target) {
        say("I can't see you right now.")
        return
      }

      if (activeTask) {
        const paused = await pauseActiveTask('player_priority')
        if (paused) say("pausing that job — coming to you now.")
      } else {
        say('coming.')
      }

      await bot.pathfinder.goto(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2))
      say("I'm here. the previous task is saved if you want me to resume it.")
      return
    }

    if (/^status$/.test(normalized)) {
      const home = memory.get('places.home')
      const storage = memory.get('storage.default')
      const task = activeTask ? `busy with ${activeTask.amount} ${activeTask.resource}` : 'idle'
      say(`I'm at ${posLabel(bot.entity.position)}. ${task}. home: ${home ? 'known' : 'unknown'}, storage: ${storage ? 'known' : 'unknown'}.`)
      return
    }

    if (/^inventory$/.test(normalized)) {
      const summary = inventorySummary(bot)
      const top = Object.entries(summary).slice(0, 8).map(([name, count]) => `${count} ${name}`).join(', ')
      say(top ? `I've got ${top}${Object.keys(summary).length > 8 ? ', and more.' : '.'}` : "my inventory is empty.")
      return
    }

    if (/^(remember|set) home$/.test(normalized)) {
      const p = bot.entity.position
      memory.set('places.home', {
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        z: Math.floor(p.z),
        dimension: bot.game.dimension,
        savedAt: new Date().toISOString()
      })
      await memory.save()
      say("got it. I'll remember this as home.")
      return
    }

    if (/^(remember|set) storage$/.test(normalized)) {
      const chest = nearestChest(bot, 8)
      if (!chest) {
        say("I don't see a chest or barrel close enough. stand near the one you want me to use.")
        return
      }

      memory.set('storage.default', serializePosition(chest, bot.game.dimension))
      await memory.save()
      say(`got it. I'll use the ${chest.name.replace('_', ' ')} at ${posLabel(chest.position)} as our default storage.`)
      return
    }

    if (/^(where is|where's) home$/.test(normalized)) {
      const home = memory.get('places.home')
      if (!home) {
        say("you haven't shown me home yet.")
        return
      }
      say(`home is at ${home.x}, ${home.y}, ${home.z}.`)
      return
    }

    if (/^(go|return) home$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something.")
        return
      }
      say('heading home.')
      await goHome()
      say("I'm home.")
      return
    }

    if (/^(resources|what can you get|what can you mine)$/.test(normalized)) {
      say(`right now I understand: ${supportedResources().join(', ')}.`)
      return
    }

    const parsed = parseIntent(normalized)

    if (parsed.type === 'unknown_resource') {
      say(`I don't know how to gather ${parsed.requested} yet. say 'Milo resources' for my current list.`)
      return
    }

    if (parsed.type === 'gather') {
      if (activeTask) {
        say(`I'm already busy getting ${activeTask.amount} ${activeTask.resource}.`)
        return
      }
      void runGatherTask(username, parsed)
      return
    }

    say("I heard you. try 'Milo get me 12 coal', 'Milo remember storage', 'Milo inventory', or 'Milo status'.")
  } catch (error) {
    console.error('[Milo] Action failed:', error)
    say(friendlyError(error))
  }
})

bot.on('death', async () => {
  const p = bot.entity?.position
  if (!p) return

  const death = {
    x: Math.floor(p.x),
    y: Math.floor(p.y),
    z: Math.floor(p.z),
    dimension: bot.game?.dimension,
    at: new Date().toISOString()
  }

  memory.set('recovery.lastDeath', death)
  memory.pushEvent('death', death)

  if (activeTask) {
    activeTask.cancelled = true
    memory.set('tasks.pending', {
      id: activeTask.id,
      intent: activeTask.intent,
      reason: 'death',
      savedAt: new Date().toISOString()
    })
    memory.set('tasks.current', null)
    memory.pushEvent('task_interrupted_by_death', {
      id: activeTask.id,
      resource: activeTask.resource,
      amount: activeTask.amount
    })
  }

  try {
    await memory.save()
  } catch (error) {
    console.error('[Milo] Failed to save death memory:', error)
  }
})

bot.on('kicked', reason => console.error('[Milo] Kicked:', reason))
bot.on('error', error => console.error('[Milo] Error:', error))
