function range(start, end) {
  const values = []
  for (let i = start; i <= end; i += 1) values.push(i)
  return values
}

export function generateStructureLayers(plan) {
  const { width, length } = plan.footprint
  const height = plan.height
  if (!width || !length || !height) throw new Error('INVALID_BUILD_PLAN')

  const foundation = []
  for (const x of range(0, width - 1)) {
    for (const z of range(0, length - 1)) foundation.push({ x, y: 0, z })
  }

  const walls = []
  const wallTop = Math.max(1, height - 2)
  for (const y of range(1, wallTop)) {
    for (const x of range(0, width - 1)) {
      walls.push({ x, y, z: 0 })
      if (length > 1) walls.push({ x, y, z: length - 1 })
    }
    for (const z of range(1, Math.max(1, length - 2))) {
      walls.push({ x: 0, y, z })
      if (width > 1) walls.push({ x: width - 1, y, z })
    }
  }

  const openings = inferOpenings(plan)
  const openingKeys = new Set(openings.flatMap(o => o.blocks.map(b => key(b))))
  const filteredWalls = walls.filter(block => !openingKeys.has(key(block)))

  const roof = generateRoof(plan)

  return {
    foundation,
    walls: filteredWalls,
    openings,
    roof,
    decorative: []
  }
}

function inferOpenings(plan) {
  const { width, length } = plan.footprint
  const openings = []

  if (width >= 5) {
    const center = Math.floor(width / 2)
    openings.push({
      id: 'main-door',
      kind: 'door',
      face: 'north',
      blocks: [
        { x: center, y: 1, z: 0 },
        { x: center, y: 2, z: 0 }
      ]
    })
  }

  if (width >= 8 && plan.height >= 5) {
    for (const x of [2, width - 3]) {
      openings.push({
        id: 'front-window-' + x,
        kind: 'window',
        face: 'north',
        blocks: [
          { x, y: 2, z: 0 },
          { x, y: 3, z: 0 }
        ]
      })
    }
  }

  if (length >= 8 && plan.height >= 5) {
    for (const z of [2, length - 3]) {
      openings.push({
        id: 'side-window-' + z,
        kind: 'window',
        face: 'west',
        blocks: [
          { x: 0, y: 2, z },
          { x: 0, y: 3, z }
        ]
      })
    }
  }

  return openings
}

function generateRoof(plan) {
  const { width, length } = plan.footprint
  const baseY = Math.max(2, plan.height - 1)
  const roofStyle = String(
    plan.sections?.find(s => s.kind === 'roof')?.notes?.find(n => String(n).startsWith('roof style:')) || ''
  ).replace('roof style:', '').trim() || 'pitched'

  if (roofStyle === 'flat') {
    const blocks = []
    for (const x of range(0, width - 1)) {
      for (const z of range(0, length - 1)) blocks.push({ x, y: baseY, z })
    }
    return { style: 'flat', blocks }
  }

  const blocks = []
  const maxRise = Math.max(1, Math.ceil(width / 2))
  for (let rise = 0; rise < maxRise; rise += 1) {
    const left = rise
    const right = width - 1 - rise
    if (left > right) break

    for (const z of range(0, length - 1)) {
      blocks.push({ x: left, y: baseY + rise, z })
      if (right !== left) blocks.push({ x: right, y: baseY + rise, z })
    }
  }

  return { style: 'pitched', blocks }
}

export function translateLocalToWorld(site, block) {
  return {
    x: site.x + block.x,
    y: site.y + block.y,
    z: site.z + block.z
  }
}

export function flattenExpectedBlocks(plan, site) {
  if (!site) throw new Error('PROJECT_SITE_MISSING')
  const layers = generateStructureLayers(plan)
  const result = []

  const roleBlock = role => {
    const hit = plan.palette.find(p => p.role === role)
    if (hit) return hit.block
    return plan.palette[0]?.block || 'cobblestone'
  }

  for (const block of layers.foundation) {
    result.push({ ...translateLocalToWorld(site, block), expected: roleBlock('foundation'), role: 'foundation' })
  }
  for (const block of layers.walls) {
    result.push({ ...translateLocalToWorld(site, block), expected: roleBlock('walls'), role: 'walls' })
  }
  for (const block of layers.roof.blocks) {
    result.push({ ...translateLocalToWorld(site, block), expected: roleBlock('roof'), role: 'roof' })
  }

  return result
}

const key = block => `${block.x},${block.y},${block.z}`
