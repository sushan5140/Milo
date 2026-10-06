function assertPositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new Error('INVALID_' + name.toUpperCase())
}

export function createBuildPlan({
  width,
  length,
  height,
  style = 'unspecified',
  palette = [],
  sections = [],
  reference = null
}) {
  assertPositiveInt(width, 'width')
  assertPositiveInt(length, 'length')
  assertPositiveInt(height, 'height')

  return {
    version: 1,
    status: 'draft',
    approved: false,
    footprint: { width, length },
    height,
    style,
    reference,
    palette: palette.map(entry => ({
      block: entry.block,
      role: entry.role || 'general',
      ratio: Number(entry.ratio ?? 0)
    })),
    sections: sections.map((section, index) => ({
      id: section.id || 'section-' + (index + 1),
      name: section.name || 'Section ' + (index + 1),
      kind: section.kind || 'structure',
      bounds: section.bounds || null,
      notes: section.notes || []
    })),
    materials: {},
    assumptions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function estimateMaterials(plan) {
  const { width, length } = plan.footprint
  const height = plan.height

  const perimeter = 2 * (width + length)
  const wallArea = perimeter * height
  const floorArea = width * length
  const roofArea = Math.ceil(floorArea * 1.25)
  const total = wallArea + floorArea + roofArea

  const palette = plan.palette.length
    ? plan.palette.filter(p => p.block)
    : [{ block: 'cobblestone', role: 'general', ratio: 1 }]

  const ratioSum = palette.reduce((sum, item) => sum + Math.max(0, item.ratio || 0), 0)
  const normalized = ratioSum > 0
    ? palette
    : palette.map((item, index) => ({ ...item, ratio: index === 0 ? 1 : 0 }))

  const denom = normalized.reduce((sum, item) => sum + Math.max(0, item.ratio || 0), 0) || 1
  const materials = {}

  for (const item of normalized) {
    const ratio = Math.max(0, item.ratio || 0) / denom
    materials[item.block] = Math.max(0, Math.ceil(total * ratio))
  }

  plan.materials = materials
  plan.assumptions = [
    'Estimate includes floor, exterior wall envelope and simplified roof surface.',
    'Doors, windows, stairs, slabs and decorative substitutions are not yet geometry-exact.',
    'This estimate is planning-only and must not trigger autonomous building.'
  ]
  plan.updatedAt = new Date().toISOString()

  return materials
}

export function approveBuildPlan(plan) {
  if (!plan?.footprint || !plan?.height) throw new Error('INVALID_BUILD_PLAN')
  plan.approved = true
  plan.status = 'approved'
  plan.approvedAt = new Date().toISOString()
  plan.updatedAt = plan.approvedAt
  return plan
}

export function reviseBuildPlan(plan, patch = {}) {
  if (patch.width !== undefined) {
    assertPositiveInt(patch.width, 'width')
    plan.footprint.width = patch.width
  }
  if (patch.length !== undefined) {
    assertPositiveInt(patch.length, 'length')
    plan.footprint.length = patch.length
  }
  if (patch.height !== undefined) {
    assertPositiveInt(patch.height, 'height')
    plan.height = patch.height
  }
  if (patch.style !== undefined) plan.style = String(patch.style)
  if (patch.palette !== undefined) plan.palette = patch.palette

  plan.approved = false
  plan.status = 'draft'
  delete plan.approvedAt
  plan.updatedAt = new Date().toISOString()
  return plan
}

export function summarizeBuildPlan(plan) {
  if (!plan) return 'No build plan yet.'
  const palette = plan.palette.slice(0, 4).map(p => p.block).join(', ') || 'not set'
  const materialCount = Object.values(plan.materials || {}).reduce((a, b) => a + b, 0)
  return [
    `${plan.footprint.width}x${plan.footprint.length}, height ${plan.height}`,
    `style ${plan.style}`,
    `palette: ${palette}`,
    `${materialCount ? materialCount + ' estimated blocks' : 'materials not estimated'}`,
    plan.approved ? 'approved' : 'draft'
  ].join(' | ')
}
