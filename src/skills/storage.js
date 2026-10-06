import { goals } from 'mineflayer-pathfinder'

export function nearestChest(bot, maxDistance = 6) {
  return bot.findBlock({
    matching: block => block && ['chest', 'trapped_chest', 'barrel'].includes(block.name),
    maxDistance
  })
}

export function serializePosition(block, dimension) {
  return {
    x: block.position.x,
    y: block.position.y,
    z: block.position.z,
    type: block.name,
    dimension,
    savedAt: new Date().toISOString()
  }
}

export async function depositItems({ bot, storage, itemNames, count }) {
  await bot.pathfinder.goto(new goals.GoalNear(storage.x, storage.y, storage.z, 2))
  const block = bot.blockAt({ x: storage.x, y: storage.y, z: storage.z })
  if (!block || !['chest', 'trapped_chest', 'barrel'].includes(block.name)) {
    throw new Error('STORAGE_MISSING')
  }

  const container = await bot.openContainer(block)
  let remaining = count
  let deposited = 0

  try {
    const wanted = new Set(itemNames)
    for (const item of bot.inventory.items()) {
      if (remaining <= 0) break
      if (!wanted.has(item.name)) continue
      const move = Math.min(item.count, remaining)
      await container.deposit(item.type, item.metadata ?? null, move)
      deposited += move
      remaining -= move
    }
  } finally {
    container.close()
  }

  return { deposited, remaining }
}
