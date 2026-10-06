import vec3 from 'vec3'
import { flattenExpectedBlocks } from './geometry.js'
import { isProtectedPosition, canExecuteSection } from './execution-safety.js'

const { Vec3 } = vec3

const REPLACEABLE = new Set([
  'air','cave_air','void_air','grass','tall_grass','fern','large_fern',
  'snow','vine','water','seagrass','kelp','dead_bush'
])

function key(p) {
  return `${p.x},${p.y},${p.z}`
}

function sectionMatches(item, sectionId) {
  if (!sectionId || sectionId === 'all') return true
  if (item.role === sectionId) return true
  if (item.role === sectionId.replace(/s$/, '')) return true
  return false
}

function hasSupport(bot, position, plannedKeys) {
  if (position.y <= -64) return true
  const below = { x: position.x, y: position.y - 1, z: position.z }
  if (plannedKeys.has(key(below))) return true

  const block = bot.blockAt(new Vec3(below.x, below.y, below.z))
  if (!block) return false
  return !REPLACEABLE.has(block.name)
}

export function dryRunSection({
  bot,
  project,
  sectionId = 'all',
  sampleLimit = 10000
}) {
  if (!project?.design?.plan) throw new Error('BUILD_PLAN_MISSING')
  if (!project?.site) throw new Error('PROJECT_SITE_MISSING')

  const safety = project.buildSafety || {
    executionEnabled: false,
    protectedZones: [],
    sectionApprovals: {}
  }

  const expected = flattenExpectedBlocks(project.design.plan, project.site)
    .filter(item => sectionMatches(item, sectionId))
    .slice(0, Math.max(1, sampleLimit))

  const plannedKeys = new Set(expected.map(key))
  const actions = []
  const counts = {
    total: expected.length,
    placeable: 0,
    alreadyCorrect: 0,
    occupied: 0,
    protected: 0,
    unsupported: 0,
    unknown: 0
  }

  for (const item of expected) {
    const position = { x: item.x, y: item.y, z: item.z }

    if (isProtectedPosition(safety, position, project.site.dimension)) {
      counts.protected += 1
      actions.push({ ...item, action: 'blocked', reason: 'protected_zone' })
      continue
    }

    const current = bot.blockAt(new Vec3(item.x, item.y, item.z))
    if (!current) {
      counts.unknown += 1
      actions.push({ ...item, action: 'blocked', reason: 'unknown_block_state' })
      continue
    }

    if (current.name === item.expected) {
      counts.alreadyCorrect += 1
      actions.push({ ...item, actual: current.name, action: 'skip', reason: 'already_correct' })
      continue
    }

    if (!REPLACEABLE.has(current.name)) {
      counts.occupied += 1
      actions.push({ ...item, actual: current.name, action: 'blocked', reason: 'occupied' })
      continue
    }

    if (!hasSupport(bot, position, plannedKeys)) {
      counts.unsupported += 1
      actions.push({ ...item, actual: current.name, action: 'blocked', reason: 'unsupported' })
      continue
    }

    counts.placeable += 1
    actions.push({ ...item, actual: current.name, action: 'would_place', reason: null })
  }

  const gate = canExecuteSection(safety, sectionId === 'all' ? 'all' : sectionId)

  return {
    projectId: project.id,
    sectionId,
    readOnly: true,
    gate,
    counts,
    actions,
    blocked: counts.occupied + counts.protected + counts.unsupported + counts.unknown,
    safeToSimulate: true,
    safeToExecute: false,
    createdAt: new Date().toISOString()
  }
}

export function summarizeDryRun(result) {
  const c = result.counts
  return [
    `${result.sectionId} dry-run`,
    `${c.total} planned`,
    `${c.placeable} placeable`,
    `${c.alreadyCorrect} already correct`,
    `${c.occupied} occupied`,
    `${c.protected} protected`,
    `${c.unsupported} unsupported`,
    `${c.unknown} unknown`,
    '0 blocks changed'
  ].join(' | ')
}

export function buildExecutionManifest(result) {
  return {
    projectId: result.projectId,
    sectionId: result.sectionId,
    generatedAt: result.createdAt,
    readOnly: true,
    executionAllowed: false,
    actions: result.actions.map((item, index) => ({
      index,
      x: item.x,
      y: item.y,
      z: item.z,
      role: item.role,
      expected: item.expected,
      actual: item.actual || null,
      action: item.action,
      reason: item.reason || null,
      state: item.state || {}
    })),
    summary: result.counts
  }
}
