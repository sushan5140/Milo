import 'dotenv/config'
import mineflayer from 'mineflayer'
import minecraftData from 'minecraft-data'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import { MemoryStore } from './memory.js'
import { parseIntent, supportedResources } from './agent/intent.js'
import { inventorySummary } from './world/inventory.js'
import { gatherResource } from './skills/gathering.js'
import { nearestChest, serializePosition, depositItems } from './skills/storage.js'
import { smeltResource } from './skills/smelting.js'

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
  if (message.startsWith('CANNOT_DIG:')) return `I reached it, but I can't safely dig ${message.split(':')[1]}.`
  return "that task broke somewhere, so I stopped instead of guessing."
}

async function runGatherTask(username, intent) {
  const { amount, resource } = intent
  const taskId = `gather-${Date.now()}`
  activeTask = { id: taskId, type: 'gather', resource: resource.canonical, amount, startedAt: new Date().toISOString() }

  memory.pushEvent('task_started', activeTask)
  await memory.save()

  say(`got it. going for ${amount} ${resource.canonical.replaceAll('_', ' ')}.`)

  try {
    const result = await gatherResource({
      bot,
      mcData,
      resource,
      amount,
      onProgress: message => say(message)
    })

    if (!result.complete) {
      say(`I only got to ${result.total}. I couldn't find enough nearby.`)
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
      const smelt = await smeltResource({
        bot,
        mcData,
        inputNames: resource.drops,
        outputName: resource.finished[0],
        amount: Math.min(amount, result.total)
      })
      processed = smelt.produced
      deliveryNames = resource.finished
      deliveryCount = smelt.produced
    }

    const storage = memory.get('storage.default')
    let deposited = 0

    if (storage && storage.dimension === bot.game.dimension) {
      const targetCount = Math.min(amount, deliveryCount)
      const deposit = await depositItems({
        bot,
        storage,
        itemNames: deliveryNames,
        count: targetCount
      })
      deposited = deposit.deposited
    }

    const outcome = {
      id: taskId,
      requested: amount,
      resource: resource.canonical,
      gathered: result.gathered,
      processed,
      totalHeld: deliveryCount,
      deposited,
      complete: resource.process === 'smelt' ? processed >= amount : result.complete,
      finishedAt: new Date().toISOString()
    }

    memory.pushEvent('task_completed', outcome)
    await memory.save()

    if (deposited > 0) {
      say(`back. I put ${deposited} ${resource.display || resource.canonical.replaceAll('_', ' ')} in storage.`)
    } else if (home) {
      say(`back home. I've got ${deliveryCount} ${resource.display || resource.canonical.replaceAll('_', ' ')} on me — show me a chest with 'Milo remember storage' and I'll use it next time.`)
    } else {
      say(`done for now. I've got ${deliveryCount} on me. you haven't shown me home yet.`)
    }
  } catch (error) {
    memory.pushEvent('task_failed', {
      id: taskId,
      resource: resource.canonical,
      amount,
      error: String(error?.message || error)
    })
    await memory.save()
    console.error('[Milo] Gather task failed:', error)
    say(friendlyError(error))
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
    if (/^(come|come here|follow me)$/.test(normalized)) {
      if (activeTask) {
        say("I'm in the middle of a task. cancellation/interruption comes in the recovery phase.")
        return
      }

      const target = bot.players[username]?.entity
      if (!target) {
        say("I can't see you right now.")
        return
      }

      say('coming.')
      await bot.pathfinder.goto(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2))
      say('here.')
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

bot.on('kicked', reason => console.error('[Milo] Kicked:', reason))
bot.on('error', error => console.error('[Milo] Error:', error))
