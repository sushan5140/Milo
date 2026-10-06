import 'dotenv/config'
import mineflayer from 'mineflayer'
import minecraftData from 'minecraft-data'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import { MemoryStore } from './memory.js'

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

function say(message) {
  bot.chat(message)
}

function isForMilo(message) {
  return /^milo\b/i.test(message.trim())
}

function stripWakeWord(message) {
  return message.trim().replace(/^milo[,:]?\s*/i, '').trim()
}

bot.once('spawn', async () => {
  const mcData = minecraftData(bot.version)
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

  const intent = stripWakeWord(message).toLowerCase()

  try {
    if (/^(come|come here|follow me)$/.test(intent)) {
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

    if (/^status$/.test(intent)) {
      const p = bot.entity.position
      const home = memory.get('places.home')
      say(`I'm at ${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}. ${home ? 'I remember home.' : "I don't know home yet."}`)
      return
    }

    if (/^(remember|set) home$/.test(intent)) {
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

    if (/^(where is|where's) home$/.test(intent)) {
      const home = memory.get('places.home')
      if (!home) {
        say("you haven't shown me home yet.")
        return
      }
      say(`home is at ${home.x}, ${home.y}, ${home.z}.`)
      return
    }

    if (/^(go|return) home$/.test(intent)) {
      const home = memory.get('places.home')
      if (!home) {
        say("I don't know where home is yet.")
        return
      }
      say("heading home.")
      await bot.pathfinder.goto(new goals.GoalNear(home.x, home.y, home.z, 2))
      say("I'm home.")
      return
    }

    say("I heard you. V0 only understands come, status, remember home, where is home, and go home so far.")
  } catch (error) {
    console.error('[Milo] Action failed:', error)
    say("that didn't work. I stopped instead of guessing.")
  }
})

bot.on('kicked', reason => console.error('[Milo] Kicked:', reason))
bot.on('error', error => console.error('[Milo] Error:', error))
