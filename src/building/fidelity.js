function now() { return new Date().toISOString() }

const CRAFT_DEPENDENCIES = {
  spruce_planks: { input: 'spruce_log', inCount: 1, outCount: 4 },
  oak_planks: { input: 'oak_log', inCount: 1, outCount: 4 },
  dark_oak_planks: { input: 'dark_oak_log', inCount: 1, outCount: 4 },
  spruce_stairs: { input: 'spruce_planks', inCount: 6, outCount: 4 },
  oak_stairs: { input: 'oak_planks', inCount: 6, outCount: 4 },
  stone_brick_stairs: { input: 'stone_bricks', inCount: 6, outCount: 4 },
  stone_brick_slab: { input: 'stone_bricks', inCount: 3, outCount: 6 },
  deepslate_tile_slab: { input: 'deepslate_tiles', inCount: 3, outCount: 6 },
  glass_pane: { input: 'glass', inCount: 6, outCount: 16 },
  stone_bricks: { input: 'stone', inCount: 4, outCount: 4 }
}

export function blockSpec(block, { role = 'general', facing = null, half = null, shape = null } = {}) {
  return {
    block,
    role,
    state: {
      ...(facing ? { facing } : {}),
      ...(half ? { half } : {}),
      ...(shape ? { shape } : {})
    }
  }
}

export function roofBlockSpec(block, side) {
  return blockSpec(block, {
    role: 'roof',
    facing: side === 'left' ? 'east' : 'west',
    half: 'bottom',
    shape: 'straight'
  })
}

export function expandCraftDependencies(materials) {
  const raw = {}
  const crafted = {}
  const unresolved = []

  function addRaw(block, count, depth = 0) {
    if (depth > 8) {
      unresolved.push({ block, count, reason: 'dependency_depth' })
      return
    }

    const recipe = CRAFT_DEPENDENCIES[block]
    if (!recipe) {
      raw[block] = (raw[block] || 0) + count
      return
    }

    crafted[block] = (crafted[block] || 0) + count
    const crafts = Math.ceil(count / recipe.outCount)
    const neededInput = crafts * recipe.inCount
    addRaw(recipe.input, neededInput, depth + 1)
  }

  for (const [block, count] of Object.entries(materials || {})) {
    if (count > 0) addRaw(block, count)
  }

  return { raw, crafted, unresolved, calculatedAt: now() }
}

export function applyBlockStateToExpected(expected, spec) {
  return {
    ...expected,
    expected: spec.block,
    state: spec.state || {},
    role: spec.role || expected.role || 'general'
  }
}


export function doorBlockSpecs(block, facing = 'north', hinge = 'left') {
  return {
    lower: blockSpec(block, { role: 'door', facing }),
    upper: {
      block,
      role: 'door',
      state: { facing, half: 'upper', hinge }
    }
  }
}

export function slabBlockSpec(block, type = 'bottom', role = 'general') {
  return {
    block,
    role,
    state: { type }
  }
}

export function stairBlockSpec(block, {
  facing = 'north',
  half = 'bottom',
  shape = 'straight',
  role = 'general'
} = {}) {
  return blockSpec(block, { role, facing, half, shape })
}
