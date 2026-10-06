import { goals } from 'mineflayer-pathfinder'
import { countItems, survivalCheck, toolClassFor, hasToolClass } from '../world/inventory.js'

const TOOL_RANK = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden']

function resolveBlockIds(mcData, names) {
  return names
    .map(name => mcData.blocksByName[name]?.id)
    .filter(Number.isInteger)
}

async function equipBestTool(bot, toolClass) {
  const items = bot.inventory.items()
  for (const material of TOOL_RANK) {
    const tool = items.find(item => item.name === `${material}_${toolClass}`)
    if (tool) {
      await bot.equip(tool, 'hand')
      return tool
    }
  }
  return null
}

export async function gatherResource({ bot, mcData, resource, amount, onProgress = () => {} }) {
  const initial = countItems(bot, resource.drops)
  const needed = Math.max(0, amount - initial)

  if (needed === 0) {
    return { gathered: 0, total: initial, alreadyHadEnough: true, complete: true }
  }

  const safety = survivalCheck(bot)
  if (!safety.safe) {
    throw new Error(`SURVIVAL_CHECK_FAILED:${safety.reason}`)
  }

  const toolClass = toolClassFor(resource)
  if (!hasToolClass(bot, toolClass) && !['dirt'].includes(resource.canonical)) {
    throw new Error(`MISSING_TOOL:${toolClass}`)
  }

  if (!['dirt'].includes(resource.canonical)) {
    await equipBestTool(bot, toolClass)
  }

  const matching = resolveBlockIds(mcData, resource.blocks)
  if (!matching.length) {
    throw new Error(`UNSUPPORTED_VERSION:${resource.canonical}`)
  }

  let noBlockAttempts = 0
  let mined = 0

  while (countItems(bot, resource.drops) < amount) {
    const safetyNow = survivalCheck(bot)
    if (!safetyNow.safe) throw new Error(`SURVIVAL_CHECK_FAILED:${safetyNow.reason}`)

    const block = bot.findBlock({
      matching,
      maxDistance: 96,
      count: 1
    })

    if (!block) {
      noBlockAttempts += 1
      if (noBlockAttempts >= 2) break
      onProgress(`I can't see any ${resource.canonical.replaceAll('_', ' ')} nearby. checking from a different spot.`)
      const p = bot.entity.position
      await bot.pathfinder.goto(new goals.GoalNear(p.x + 12, p.y, p.z + 12, 2))
      continue
    }

    noBlockAttempts = 0
    await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1))

    const freshBlock = bot.blockAt(block.position)
    if (!freshBlock || freshBlock.name === 'air') continue
    if (!bot.canDigBlock(freshBlock)) throw new Error(`CANNOT_DIG:${freshBlock.name}`)

    await bot.dig(freshBlock, true)
    mined += 1
  }

  const total = countItems(bot, resource.drops)
  return {
    gathered: Math.max(0, total - initial),
    total,
    mined,
    complete: total >= amount
  }
}
