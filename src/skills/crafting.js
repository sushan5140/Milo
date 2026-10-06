import { goals } from 'mineflayer-pathfinder'

const TOOL_ORDER = ['wooden', 'golden', 'stone', 'iron', 'diamond', 'netherite']
const MINING_TIER = {
  coal: 'wooden',
  cobblestone: 'wooden',
  copper: 'stone',
  raw_copper: 'stone',
  iron: 'stone',
  raw_iron: 'stone',
  lapis: 'stone',
  gold: 'iron',
  raw_gold: 'iron',
  redstone: 'iron',
  diamond: 'iron',
  emerald: 'iron'
}

function item(bot, name) {
  return bot.inventory.items().find(i => i.name === name) || null
}

function toolRank(material) {
  return TOOL_ORDER.indexOf(material)
}

function requiredTier(resource) {
  return MINING_TIER[resource.canonical] || 'wooden'
}

export function validTool(bot, toolClass, resource) {
  const min = toolRank(requiredTier(resource))
  return bot.inventory.items()
    .filter(i => i.name.endsWith(`_${toolClass}`))
    .map(i => ({ item: i, material: i.name.slice(0, -(`_${toolClass}`.length)) }))
    .filter(x => toolRank(x.material) >= min)
    .sort((a, b) => toolRank(b.material) - toolRank(a.material))[0]?.item || null
}

function craftingTableBlock(bot, mcData, maxDistance = 16) {
  const id = mcData.blocksByName.crafting_table?.id
  if (!Number.isInteger(id)) return null
  return bot.findBlock({ matching: id, maxDistance })
}

async function craftByName(bot, mcData, name, count = 1, table = null) {
  const target = mcData.itemsByName[name]
  if (!target) return false

  const recipes = bot.recipesFor(target.id, null, count, table)
  if (!recipes?.length) return false

  await bot.craft(recipes[0], count, table)
  return true
}

async function ensureBasicParts(bot, mcData, table) {
  const logs = bot.inventory.items().find(i => i.name.endsWith('_log'))
  const plankCount = bot.inventory.items()
    .filter(i => i.name.endsWith('_planks'))
    .reduce((n, i) => n + i.count, 0)

  if (plankCount < 3 && logs) {
    const plankName = logs.name.replace('_log', '_planks')
    await craftByName(bot, mcData, plankName, 1, null)
  }

  const sticks = item(bot, 'stick')
  if (!sticks || sticks.count < 2) {
    await craftByName(bot, mcData, 'stick', 1, null)
  }

  return table
}

function candidateMaterials(bot, toolClass, resource) {
  const min = toolRank(requiredTier(resource))
  const available = []

  for (const material of ['diamond', 'iron', 'stone', 'golden', 'wooden']) {
    if (toolRank(material) < min) continue

    const ingredient = material === 'stone'
      ? 'cobblestone'
      : material === 'wooden'
        ? null
        : material === 'golden'
          ? 'gold_ingot'
          : `${material}_ingot`.replace('diamond_ingot', 'diamond')

    if (material === 'wooden') {
      const planks = bot.inventory.items().filter(i => i.name.endsWith('_planks')).reduce((n, i) => n + i.count, 0)
      if (planks >= (toolClass === 'axe' ? 3 : toolClass === 'pickaxe' ? 3 : 1)) available.push(material)
    } else {
      const needed = toolClass === 'shovel' ? 1 : 3
      const have = bot.inventory.items().filter(i => i.name === ingredient).reduce((n, i) => n + i.count, 0)
      if (have >= needed) available.push(material)
    }
  }

  return available
}

export async function ensureTool({ bot, mcData, toolClass, resource }) {
  const existing = validTool(bot, toolClass, resource)
  if (existing) {
    await bot.equip(existing, 'hand')
    return { crafted: false, tool: existing.name }
  }

  const table = craftingTableBlock(bot, mcData)
  if (!table) throw new Error('CRAFTING_TABLE_MISSING')

  await bot.pathfinder.goto(new goals.GoalNear(table.position.x, table.position.y, table.position.z, 2))
  await ensureBasicParts(bot, mcData, table)

  const materials = candidateMaterials(bot, toolClass, resource)
  if (!materials.length) throw new Error(`TOOL_MATERIALS_MISSING:${toolClass}:${requiredTier(resource)}`)

  const material = materials[0]
  const toolName = `${material}_${toolClass}`
  const crafted = await craftByName(bot, mcData, toolName, 1, table)
  if (!crafted) throw new Error(`TOOL_CRAFT_FAILED:${toolName}`)

  const made = item(bot, toolName)
  if (!made) throw new Error(`TOOL_CRAFT_FAILED:${toolName}`)
  await bot.equip(made, 'hand')

  return { crafted: true, tool: toolName }
}
