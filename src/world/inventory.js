const FOOD_HINTS = [
  'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton',
  'cooked_rabbit', 'baked_potato', 'carrot', 'apple', 'golden_carrot'
]

export function countItems(bot, names) {
  const wanted = new Set(Array.isArray(names) ? names : [names])
  return bot.inventory.items()
    .filter(item => wanted.has(item.name))
    .reduce((sum, item) => sum + item.count, 0)
}

export function inventorySummary(bot) {
  const totals = new Map()
  for (const item of bot.inventory.items()) {
    totals.set(item.name, (totals.get(item.name) || 0) + item.count)
  }
  return Object.fromEntries([...totals.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

export function survivalCheck(bot) {
  const foodItems = bot.inventory.items().filter(item => FOOD_HINTS.includes(item.name))
  const foodCount = foodItems.reduce((sum, item) => sum + item.count, 0)
  const health = Number(bot.health ?? 20)
  const hunger = Number(bot.food ?? 20)

  return {
    health,
    hunger,
    foodCount,
    safe: health >= 8 && (hunger >= 8 || foodCount > 0),
    reason: health < 8
      ? 'health is too low'
      : hunger < 8 && foodCount === 0
        ? 'hunger is low and I have no food'
        : null
  }
}

export function toolClassFor(resource) {
  const c = resource.canonical
  if (c.includes('log')) return 'axe'
  if (['dirt'].includes(c)) return 'shovel'
  return 'pickaxe'
}

export function hasToolClass(bot, toolClass) {
  return bot.inventory.items().some(item => item.name.endsWith(`_${toolClass}`))
}
