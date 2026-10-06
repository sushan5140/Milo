function countInventory(bot) {
  const counts = {}
  for (const item of bot.inventory.items()) {
    counts[item.name] = (counts[item.name] || 0) + item.count
  }
  return counts
}

export function sectionMaterialNeeds(project, sectionId = 'all') {
  const manifest = project?.buildSafety?.lastManifest
  if (!manifest) throw new Error('DRY_RUN_MANIFEST_MISSING')
  if (sectionId !== 'all' && manifest.sectionId !== sectionId) {
    throw new Error('MANIFEST_SECTION_MISMATCH')
  }

  const needs = {}
  for (const action of manifest.actions || []) {
    if (action.action !== 'would_place') continue
    needs[action.expected] = (needs[action.expected] || 0) + 1
  }
  return needs
}

export function inventoryReadiness(bot, project, sectionId = 'all') {
  const needs = sectionMaterialNeeds(project, sectionId)
  const have = countInventory(bot)
  const missing = {}
  const ready = {}

  for (const [block, count] of Object.entries(needs)) {
    const available = have[block] || 0
    ready[block] = Math.min(available, count)
    if (available < count) missing[block] = count - available
  }

  return {
    sectionId,
    needs,
    have,
    ready,
    missing,
    complete: Object.keys(missing).length === 0
  }
}

export function summarizeInventoryReadiness(result) {
  const missing = Object.entries(result.missing)
  if (!missing.length) return `${result.sectionId} inventory ready: all dry-run placement blocks are available.`
  return `${result.sectionId} inventory missing: ${missing.slice(0, 5).map(([name,count]) => count + ' ' + name).join(', ')}${missing.length > 5 ? ', and more' : ''}.`
}
