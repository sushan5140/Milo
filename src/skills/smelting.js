import { goals } from 'mineflayer-pathfinder'
import vec3 from 'vec3'
import { countItems } from '../world/inventory.js'

const { Vec3 } = vec3
const FUEL_VALUES = {
  coal: 8,
  charcoal: 8,
  coal_block: 80,
  blaze_rod: 12,
  dried_kelp_block: 20
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function findInventoryItem(bot, names) {
  const wanted = new Set(names)
  return bot.inventory.items().find(item => wanted.has(item.name)) || null
}

export function nearestFurnace(bot, mcData, maxDistance = 16) {
  const ids = ['furnace', 'blast_furnace']
    .map(name => mcData.blocksByName[name]?.id)
    .filter(Number.isInteger)

  if (!ids.length) return null
  return bot.findBlock({ matching: ids, maxDistance })
}

function findFuel(bot, neededSmelts) {
  const fuels = bot.inventory.items()
    .filter(i => FUEL_VALUES[i.name])
    .map(i => ({
      item: i,
      value: FUEL_VALUES[i.name],
      pieces: Math.ceil(neededSmelts / FUEL_VALUES[i.name])
    }))
    .filter(x => x.item.count >= x.pieces)
    .sort((a, b) => (a.pieces * a.value - neededSmelts) - (b.pieces * b.value - neededSmelts))

  return fuels[0] || null
}

function placementCandidate(bot, maxDistance = 6) {
  return bot.findBlock({
    maxDistance,
    matching: block => {
      if (!block || block.name === 'air' || block.boundingBox === 'empty') return false
      const above = bot.blockAt(block.position.offset(0, 1, 0))
      return above?.name === 'air'
    }
  })
}

async function placeInventoryFurnace(bot) {
  const furnaceItem = findInventoryItem(bot, ['furnace'])
  if (!furnaceItem) return null

  const support = placementCandidate(bot)
  if (!support) throw new Error('NO_SAFE_FURNACE_SPOT')

  await bot.pathfinder.goto(new goals.GoalNear(support.position.x, support.position.y + 1, support.position.z, 2))
  await bot.equip(furnaceItem, 'hand')
  await bot.placeBlock(support, new Vec3(0, 1, 0))

  return bot.blockAt(support.position.offset(0, 1, 0))
}

async function waitForOutput(furnace, expectedName, minimumCount, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const output = furnace.outputItem()
    if (output?.name === expectedName && output.count >= minimumCount) return
    await sleep(750)
  }
  throw new Error('SMELT_TIMEOUT')
}

export async function smeltResource({ bot, mcData, inputNames, outputName, amount }) {
  let furnaceBlock = nearestFurnace(bot, mcData)
  if (!furnaceBlock) furnaceBlock = await placeInventoryFurnace(bot)
  if (!furnaceBlock) throw new Error('FURNACE_MISSING')

  await bot.pathfinder.goto(new goals.GoalNear(
    furnaceBlock.position.x,
    furnaceBlock.position.y,
    furnaceBlock.position.z,
    2
  ))

  let remaining = Math.min(amount, countItems(bot, inputNames))
  if (remaining <= 0) throw new Error('SMELT_INPUT_MISSING')

  let produced = 0

  while (remaining > 0) {
    const input = findInventoryItem(bot, inputNames)
    if (!input) break

    const batch = Math.min(remaining, input.count, 64)
    const fuelPlan = findFuel(bot, batch)
    if (!fuelPlan) throw new Error('FUEL_MISSING')

    const furnace = await bot.openFurnace(furnaceBlock)

    try {
      const existingInput = furnace.inputItem()
      const existingOutput = furnace.outputItem()

      if (existingInput && !inputNames.includes(existingInput.name)) throw new Error('FURNACE_BUSY')
      if (existingOutput && existingOutput.name !== outputName) throw new Error('FURNACE_BUSY')

      await furnace.putInput(input.type, input.metadata ?? null, batch)

      if (!furnace.fuelItem() || furnace.fuel <= 0.05) {
        await furnace.putFuel(
          fuelPlan.item.type,
          fuelPlan.item.metadata ?? null,
          Math.min(fuelPlan.item.count, fuelPlan.pieces)
        )
      }

      const priorOutput = existingOutput?.name === outputName ? existingOutput.count : 0
      await waitForOutput(furnace, outputName, priorOutput + batch, (batch * 12000) + 15000)

      const output = await furnace.takeOutput()
      if (output?.name !== outputName) throw new Error('SMELT_OUTPUT_MISMATCH')
      produced += output.count
    } finally {
      furnace.close()
    }

    remaining = Math.max(0, amount - produced)
  }

  return { produced, complete: produced >= amount }
}
