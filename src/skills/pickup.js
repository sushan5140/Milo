import { goals } from 'mineflayer-pathfinder'
import { countItems } from '../world/inventory.js'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

function safeDrop(bot, entity, origin) {
  if (entity?.name !== 'item' || !entity.position || entity.position.distanceTo(origin) > 5) return false
  for (const y of [0, -1]) {
    const block = bot.blockAt(entity.position.floored().offset(0, y, 0))
    if (block && ['lava', 'fire', 'soul_fire', 'cactus', 'magma_block'].includes(block.name)) return false
  }
  return true
}

// Mineflayer picks up drops by walking close to them; block destruction alone is not proof of collection.
// All success conditions use the inventory count, never the number of blocks dug.
export async function collectNearbyDrops({
  bot, itemNames, origin, targetCount, shouldCancel = () => false,
  timeoutMs = 4500
}) {
  const deadline = Date.now() + timeoutMs
  let approached = 0
  const attempted = new Set()

  while (Date.now() < deadline && countItems(bot, itemNames) < targetCount) {
    if (shouldCancel()) throw new Error('TASK_CANCELLED')
    const drops = Object.values(bot.entities || {})
      .filter(entity => safeDrop(bot, entity, origin) && !attempted.has(entity.id))
      .sort((a, b) => a.position.distanceTo(origin) - b.position.distanceTo(origin))

    if (drops.length) {
      const drop = drops[0]
      attempted.add(drop.id)
      try {
        await bot.pathfinder.goto(new goals.GoalNear(
          drop.position.x, drop.position.y, drop.position.z, 1
        ))
        approached += 1
      } catch {
        // A drop may disappear, be unreachable, or be collected by someone else.
        // Never count it unless the inventory changed.
      }
    }
    // Item entities can appear after the dig promise resolves; allow a bounded spawn/pickup delay.
    await pause(Math.min(250, Math.max(0, deadline - Date.now())))
  }
  return { approached, collected: countItems(bot, itemNames) }
}
