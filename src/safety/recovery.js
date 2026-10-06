import { goals } from 'mineflayer-pathfinder'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function recoverDeathItems({ bot, death, maxAgeMs = 5 * 60 * 1000 }) {
  if (!death) throw new Error('NO_DEATH_MEMORY')
  if (Date.now() - new Date(death.at).getTime() > maxAgeMs) throw new Error('DEATH_MEMORY_STALE')
  if (death.dimension && death.dimension !== bot.game.dimension) throw new Error('DEATH_OTHER_DIMENSION')

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
      await sleep(250)
    }

    await sleep(500)
  }

  return { approached }
}
