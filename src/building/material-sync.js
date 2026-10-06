const DIRECT_RESOURCE = {
  cobblestone: 'cobblestone',
  dirt: 'dirt',
  coal: 'coal',
  diamond: 'diamond',
  redstone: 'redstone',
  lapis_lazuli: 'lapis',
  emerald: 'emerald',
  oak_log: 'oak',
  spruce_log: 'spruce'
}

function baseResourceForBlock(block) {
  if (DIRECT_RESOURCE[block]) return DIRECT_RESOURCE[block]
  if (block.startsWith('spruce_')) return 'spruce'
  if (block.startsWith('oak_')) return 'oak'
  if (block.includes('stone') || block.includes('cobblestone')) return 'cobblestone'
  if (block.startsWith('iron_')) return 'iron'
  if (block.startsWith('gold_')) return 'gold'
  if (block.startsWith('copper_')) return 'copper'
  return null
}

export function planToResourceBill(plan, parseIntent) {
  const bill = []
  const unresolved = []

  for (const [block, count] of Object.entries(plan.materials || {})) {
    if (!count) continue
    const resourceName = baseResourceForBlock(block)
    if (!resourceName) {
      unresolved.push({ block, count, reason: 'no resource mapping' })
      continue
    }

    const intent = parseIntent(`get ${count} ${resourceName}`)
    if (intent.type !== 'gather') {
      unresolved.push({ block, count, reason: 'resource parser rejected mapping' })
      continue
    }

    bill.push({
      block,
      count,
      resourceName,
      resource: intent.resource
    })
  }

  return { bill, unresolved }
}

export function syncPlanMaterialsToProject(project, plan, parseIntent) {
  const { bill, unresolved } = planToResourceBill(plan, parseIntent)

  project.materials = {}
  for (const item of bill) {
    const key = item.resource.canonical
    const current = project.materials[key] || {
      canonical: key,
      display: item.resource.display || key.replaceAll('_', ' '),
      target: 0,
      delivered: 0,
      resource: item.resource,
      sources: []
    }

    current.target += item.count
    current.sources.push({ block: item.block, count: item.count })
    project.materials[key] = current
  }

  project.design ??= {}
  project.design.unresolvedMaterials = unresolved
  project.updatedAt = new Date().toISOString()

  return { bill, unresolved }
}
