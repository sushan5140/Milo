const FOOD_PRIORITY = [
  'golden_carrot',
  'cooked_beef',
  'cooked_porkchop',
  'cooked_mutton',
  'cooked_chicken',
  'bread',
  'baked_potato',
  'carrot',
  'apple'
]

export function bestFood(bot) {
  for (const name of FOOD_PRIORITY) {
    const item = bot.inventory.items().find(i => i.name === name)
    if (item) return item
  }
  return null
}

export async function ensureFed(bot, {
  hungerThreshold = 14,
  healthThreshold = 10,
  maxEats = 3
} = {}) {
  let eaten = 0

  while (
    eaten < maxEats &&
    ((bot.food ?? 20) < hungerThreshold || (bot.health ?? 20) < healthThreshold)
  ) {
    const food = bestFood(bot)
    if (!food) {
      if ((bot.health ?? 20) < healthThreshold) throw new Error('NO_FOOD_LOW_HEALTH')
      if ((bot.food ?? 20) < hungerThreshold) throw new Error('NO_FOOD_LOW_HUNGER')
      break
    }

    await bot.equip(food, 'hand')
    await bot.consume()
    eaten += 1
  }

  return {
    eaten,
    health: Number(bot.health ?? 20),
    hunger: Number(bot.food ?? 20)
  }
}
