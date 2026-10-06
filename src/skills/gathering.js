import { goals } from 'mineflayer-pathfinder'
import { countItems, survivalCheck, toolClassFor, hasToolClass } from '../world/inventory.js'
import { ensureTool } from './crafting.js'
import { ensureFed } from '../safety/survival.js'

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

function hazardNear(bot, position) {
  const hazards = new Set(['lava', 'fire', 'soul_fire'])
  const offsets = [
    [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    [1,-1,0],[-1,-1,0],[0,-1,1],[0,-1,-1]
  ]

  for (const [x,y,z] of offsets) {
    const block = bot.blockAt(position.offset(x,y,z))
    if (block && hazards.has(block.name)) return block.name
  }
  return null
}

export async function gatherResource({
  bot,
  mcData,
  resource,
  amount,
  onProgress = () => {},
  shouldCancel = () => false
}) {
  const initial = countItems(bot, resource.drops)
  const needed = Math.max(0, amount - initial)

  if (needed === 0) {
    return { gathered: 0, total: initial, alreadyHadEnough: true, complete: true }
  }

  const safety = survivalCheck(bot)
  if (!safety.safe) {
    const recovery = await ensureFed(bot)
    const after = survivalCheck(bot)
    if (!after.safe) throw new Error(`SURVIVAL_CHECK_FAILED:${after.reason || 'could not recover'}`)
    if (recovery.eaten > 0) onProgress(`I ate before heading out so I don't start the task in bad shape.`)
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
  let hazardousBlocksSkipped = 0
  let searchStep = 0
  const searchOffsets = [
    [16, 0], [0, 16], [-16, 0], [0, -16],
    [24, 24], [-24, 24], [-24, -24], [24, -24]
  ]

  while (countItems(bot, resource.drops) < amount) {
    if (shouldCancel()) throw new Error('TASK_CANCELLED')
    const safetyNow = survivalCheck(bot)
    if (!safetyNow.safe) {
      const recovery = await ensureFed(bot)
      const after = survivalCheck(bot)
      if (!after.safe) throw new Error(`SURVIVAL_CHECK_FAILED:${after.reason || 'could not recover'}`)
      if (recovery.eaten > 0) onProgress(`I stopped to eat ${recovery.eaten} time${recovery.eaten === 1 ? '' : 's'} before continuing.`)
    }

    if (!['dirt'].includes(resource.canonical)) {
      const toolClass = toolClassFor(resource)
      const tool = await ensureTool({ bot, mcData, toolClass, resource })
      if (tool.crafted) onProgress(`my ${toolClass} was gone or invalid, so I replaced it with a ${tool.tool.replaceAll('_', ' ')}.`)
    }

    const block = bot.findBlock({
      matching,
      maxDistance: 96,
      count: 1
    })

    if (!block) {
      noBlockAttempts += 1
      if (noBlockAttempts >= 2) break
      const [dx, dz] = searchOffsets[searchStep % searchOffsets.length]
      searchStep += 1
      onProgress(`I can't see any ${resource.canonical.replaceAll('_', ' ')} nearby. checking another direction.`)
      const p = bot.entity.position
      await bot.pathfinder.goto(new goals.GoalNear(p.x + dx, p.y, p.z + dz, 2))
      continue
    }

    const hazard = hazardNear(bot, block.position)
    if (hazard) {
      hazardousBlocksSkipped += 1
      onProgress(`there's ${hazard.replaceAll('_', ' ')} right beside this block, so I'm leaving it.`)
      if (hazardousBlocksSkipped >= 3) break
      const [dx, dz] = searchOffsets[searchStep % searchOffsets.length]
      searchStep += 1
      const p = bot.entity.position
      await bot.pathfinder.goto(new goals.GoalNear(p.x + Math.sign(dx) * 8, p.y, p.z + Math.sign(dz) * 8, 2))
      continue
    }

    noBlockAttempts = 0
    await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1))
    if (shouldCancel()) throw new Error('TASK_CANCELLED')

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
    hazardousBlocksSkipped,
    complete: total >= amount
  }
}
