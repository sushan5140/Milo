import { createBuildPlan, estimateMaterials } from './plan.js'

const STYLE_DEFAULTS = {
  japanese: [
    { block: 'spruce_planks', role: 'walls', ratio: 0.45 },
    { block: 'dark_oak_log', role: 'frame', ratio: 0.2 },
    { block: 'stone_bricks', role: 'foundation', ratio: 0.15 },
    { block: 'deepslate_tile_slab', role: 'roof', ratio: 0.2 }
  ],
  medieval: [
    { block: 'spruce_planks', role: 'walls', ratio: 0.4 },
    { block: 'oak_log', role: 'frame', ratio: 0.2 },
    { block: 'cobblestone', role: 'foundation', ratio: 0.2 },
    { block: 'stone_brick_stairs', role: 'roof', ratio: 0.2 }
  ],
  modern: [
    { block: 'white_concrete', role: 'walls', ratio: 0.5 },
    { block: 'glass', role: 'windows', ratio: 0.2 },
    { block: 'smooth_stone', role: 'foundation', ratio: 0.2 },
    { block: 'quartz_slab', role: 'roof', ratio: 0.1 }
  ]
}

function safeInt(value, fallback, min = 4, max = 128) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function observationsToBuildPlan(observations = {}) {
  const style = String(observations.style || 'unspecified').toLowerCase()
  const width = safeInt(observations.width, 12)
  const length = safeInt(observations.length, 16)
  const height = safeInt(observations.height, 7, 3, 64)

  const palette = Array.isArray(observations.palette) && observations.palette.length
    ? observations.palette
    : (STYLE_DEFAULTS[style] || [])

  const plan = createBuildPlan({
    width,
    length,
    height,
    style,
    palette,
    reference: {
      source: observations.source || 'image-observation',
      confidence: Number(observations.confidence ?? 0),
      notes: observations.notes || [],
      capturedAt: new Date().toISOString()
    }
  })

  plan.sections = inferSections({
    width,
    length,
    height,
    roof: observations.roof || 'pitched',
    windows: observations.windows ?? 'unknown',
    entrances: observations.entrances ?? 1
  })

  estimateMaterials(plan)
  return plan
}

export function inferSections({ width, length, height, roof = 'pitched', windows = 'unknown', entrances = 1 }) {
  return [
    {
      id: 'foundation',
      name: 'Foundation',
      kind: 'foundation',
      bounds: { x: 0, y: 0, z: 0, width, length, height: 1 },
      notes: ['Ground-contact layer']
    },
    {
      id: 'walls',
      name: 'Exterior walls',
      kind: 'walls',
      bounds: { x: 0, y: 1, z: 0, width, length, height: Math.max(1, height - 2) },
      notes: [`windows: ${windows}`, `entrances: ${entrances}`]
    },
    {
      id: 'roof',
      name: 'Roof',
      kind: 'roof',
      bounds: { x: 0, y: Math.max(1, height - 1), z: 0, width, length, height: 2 },
      notes: [`roof style: ${roof}`]
    }
  ]
}
