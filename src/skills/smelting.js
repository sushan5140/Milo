import { goals } from 'mineflayer-pathfinder'
import { countItems } from '../world/inventory.js'

const FUEL_NAMES = ['coal', 'charcoal']

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

  return bot.findBlock({
    matching: ids,
    maxDistance
  })
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
  const furnaceBlock = nearestFurnace(bot, mcData)
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
    const fuel = findInventoryItem(bot, FUEL_NAMES)
    if (!fuel) throw new Error('FUEL_MISSING')

    const furnace = await bot.openFurnace(furnaceBlock)

    try {
      const existingInput = furnace.inputItem()
      const existingOutput = furnace.outputItem()

      if (existingInput && !inputNames.includes(existingInput.name)) {
        throw new Error('FURNACE_BUSY')
      }
      if (existingOutput && existingOutput.name !== outputName) {
        throw new Error('FURNACE_BUSY')
      }

      const fuelNeeded = Math.max(1, Math.ceil(batch / 8))
      if (fuel.count < fuelNeeded && !furnace.fuelItem()) {
        throw new Error('FUEL_MISSING')
      }

      await furnace.putInput(input.type, input.metadata ?? null, batch)

      if (!furnace.fuelItem() || furnace.fuel <= 0.05) {
        await furnace.putFuel(fuel.type, fuel.metadata ?? null, Math.min(fuel.count, fuelNeeded))
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
