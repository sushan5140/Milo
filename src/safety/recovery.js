import { goals } from 'mineflayer-pathfinder'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function snapshotInventory(bot) {
  const totals = {}
  for (const item of bot.inventory.items()) {
    totals[item.name] = (totals[item.name] || 0) + item.count
  }
  return totals
}

function inventoryDelta(before, after) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  const recovered = {}
  for (const name of names) {
    const delta = (after[name] || 0) - (before[name] || 0)
    if (delta > 0) recovered[name] = delta
  }
  return recovered
}

export async function recoverDeathItems({ bot, death, maxAgeMs = 5 * 60 * 1000 }) {
  if (!death) throw new Error('NO_DEATH_MEMORY')
  if (Date.now() - new Date(death.at).getTime() > maxAgeMs) throw new Error('DEATH_MEMORY_STALE')
  if (death.dimension && death.dimension !== bot.game.dimension) throw new Error('DEATH_OTHER_DIMENSION')

  const before = snapshotInventory(bot)

  await bot.pathfinder.goto(new goals.GoalNear(death.x, death.y, death.z, 3))

  const deadline = Date.now() + 15000
  let approached = 0

  while (Date.now() < deadline) {
    const drops = Object.values(bot.entities)
      .filter(entity => entity?.name === 'item')
      .filter(entity => entity.position.distanceTo(bot.entity.position) <= 12)
      .sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position))

    if (!drops.length) {
      await sleep(750)
      continue
    }

    for (const entity of drops.slice(0, 12)) {
      await bot.pathfinder.goto(new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1))
      approached += 1
      await sleep(300)
    }

    await sleep(500)
  }

  const after = snapshotInventory(bot)
  const recovered = inventoryDelta(before, after)
  const recoveredCount = Object.values(recovered).reduce((sum, count) => sum + count, 0)

  return {
    approached,
    before,
    after,
    recovered,
    recoveredCount,
    verified: recoveredCount > 0
  }
}
