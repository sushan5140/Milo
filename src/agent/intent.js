const RESOURCE_ALIASES = {
  iron: { canonical: 'iron', blocks: ['iron_ore', 'deepslate_iron_ore'], drops: ['raw_iron', 'iron_ore'] },
  coal: { canonical: 'coal', blocks: ['coal_ore', 'deepslate_coal_ore'], drops: ['coal'] },
  diamond: { canonical: 'diamond', blocks: ['diamond_ore', 'deepslate_diamond_ore'], drops: ['diamond'] },
  diamonds: { canonical: 'diamond', blocks: ['diamond_ore', 'deepslate_diamond_ore'], drops: ['diamond'] },
  copper: { canonical: 'copper', blocks: ['copper_ore', 'deepslate_copper_ore'], drops: ['raw_copper'] },
  gold: { canonical: 'gold', blocks: ['gold_ore', 'deepslate_gold_ore'], drops: ['raw_gold', 'gold_ore'] },
  redstone: { canonical: 'redstone', blocks: ['redstone_ore', 'deepslate_redstone_ore'], drops: ['redstone'] },
  lapis: { canonical: 'lapis', blocks: ['lapis_ore', 'deepslate_lapis_ore'], drops: ['lapis_lazuli'] },
  emerald: { canonical: 'emerald', blocks: ['emerald_ore', 'deepslate_emerald_ore'], drops: ['emerald'] },
  emeralds: { canonical: 'emerald', blocks: ['emerald_ore', 'deepslate_emerald_ore'], drops: ['emerald'] },
  cobblestone: { canonical: 'cobblestone', blocks: ['stone'], drops: ['cobblestone'] },
  stone: { canonical: 'cobblestone', blocks: ['stone'], drops: ['cobblestone'] },
  dirt: { canonical: 'dirt', blocks: ['dirt'], drops: ['dirt'] },
  oak: { canonical: 'oak_log', blocks: ['oak_log'], drops: ['oak_log'] },
  'oak log': { canonical: 'oak_log', blocks: ['oak_log'], drops: ['oak_log'] },
  'oak logs': { canonical: 'oak_log', blocks: ['oak_log'], drops: ['oak_log'] },
  spruce: { canonical: 'spruce_log', blocks: ['spruce_log'], drops: ['spruce_log'] },
  'spruce log': { canonical: 'spruce_log', blocks: ['spruce_log'], drops: ['spruce_log'] },
  'spruce logs': { canonical: 'spruce_log', blocks: ['spruce_log'], drops: ['spruce_log'] }
}

export function parseIntent(text) {
  const normalized = text.trim().toLowerCase()

  const gather = normalized.match(/^(?:get|grab|bring|fetch|mine|collect)(?: me)?\s+(?:(\d+)\s+)?(.+?)(?:\s+please)?$/)
  if (gather) {
    const amount = Math.min(Math.max(Number(gather[1] || 1), 1), 2304)
    const requested = gather[2].trim().replace(/\s+(?:for me|pls)$/i, '')
    const resource = RESOURCE_ALIASES[requested]
    if (resource) return { type: 'gather', amount, requested, resource }
    return { type: 'unknown_resource', amount, requested }
  }

  return { type: 'unknown', text: normalized }
}

export function supportedResources() {
  return [...new Set(Object.values(RESOURCE_ALIASES).map(v => v.canonical))].sort()
}
