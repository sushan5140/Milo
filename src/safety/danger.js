const HOSTILE_HINTS = new Set([
  'zombie','skeleton','creeper','spider','cave_spider','witch','drowned','husk',
  'stray','pillager','vindicator','evoker','ravager','phantom','slime','magma_cube',
  'blaze','ghast','hoglin','zoglin','piglin_brute','warden','enderman'
])

export function nearestHostile(bot, radius = 10) {
  let best = null
  let bestDistance = Infinity

  for (const entity of Object.values(bot.entities)) {
    if (!entity || entity === bot.entity) continue
    const name = String(entity.name || entity.mobType || '').toLowerCase()
    if (!HOSTILE_HINTS.has(name)) continue

    const distance = entity.position.distanceTo(bot.entity.position)
    if (distance <= radius && distance < bestDistance) {
      best = entity
      bestDistance = distance
    }
  }

  return best ? { entity: best, distance: bestDistance, name: best.name || best.mobType || 'hostile mob' } : null
}

export function immediateEnvironmentRisk(bot) {
  if (bot.entity?.isInWater && (bot.oxygenLevel ?? 20) <= 8) {
    return { code: 'DROWNING_RISK', detail: 'oxygen is low' }
  }

  if (bot.entity?.isInLava || bot.entity?.onFire) {
    return { code: 'FIRE_RISK', detail: 'currently burning or in lava' }
  }

  const hostile = nearestHostile(bot, 8)
  if (hostile) {
    return { code: 'HOSTILE_NEARBY', detail: hostile.name, distance: hostile.distance }
  }

  return null
}
