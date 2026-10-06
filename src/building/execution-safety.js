function now() { return new Date().toISOString() }

export function createBuildSafetyState() {
  return {
    executionEnabled: false,
    protectedZones: [],
    sectionApprovals: {},
    rollbackLog: []
  }
}

export function addProtectedZone(state, {
  name,
  min,
  max,
  dimension = null
}) {
  if (!name || !min || !max) throw new Error('INVALID_PROTECTED_ZONE')

  const zone = {
    id: String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    name,
    min: {
      x: Math.min(min.x, max.x),
      y: Math.min(min.y, max.y),
      z: Math.min(min.z, max.z)
    },
    max: {
      x: Math.max(min.x, max.x),
      y: Math.max(min.y, max.y),
      z: Math.max(min.z, max.z)
    },
    dimension,
    createdAt: now()
  }

  state.protectedZones.push(zone)
  return zone
}

export function isProtectedPosition(state, position, dimension = null) {
  return state.protectedZones.some(zone => {
    if (zone.dimension && dimension && zone.dimension !== dimension) return false
    return position.x >= zone.min.x && position.x <= zone.max.x &&
      position.y >= zone.min.y && position.y <= zone.max.y &&
      position.z >= zone.min.z && position.z <= zone.max.z
  })
}

export function approveBuildSection(state, sectionId, approvedBy = 'owner') {
  state.sectionApprovals[sectionId] = {
    approved: true,
    approvedBy,
    approvedAt: now()
  }
  return state.sectionApprovals[sectionId]
}

export function revokeBuildSectionApproval(state, sectionId) {
  state.sectionApprovals[sectionId] = {
    approved: false,
    revokedAt: now()
  }
}

export function isSectionApproved(state, sectionId) {
  return Boolean(state.sectionApprovals?.[sectionId]?.approved)
}

export function createRollbackSnapshot({
  projectId,
  sectionId,
  positions,
  reason = 'pre-execution-snapshot'
}) {
  return {
    id: `rollback-${Date.now()}-${sectionId}`,
    projectId,
    sectionId,
    reason,
    positions: positions.map(p => ({
      x: p.x,
      y: p.y,
      z: p.z,
      before: p.before || null,
      after: p.after || null
    })),
    createdAt: now(),
    applied: false
  }
}

export function recordRollbackSnapshot(state, snapshot) {
  state.rollbackLog.push(snapshot)
  if (state.rollbackLog.length > 100) state.rollbackLog = state.rollbackLog.slice(-100)
  return snapshot
}

export function canExecuteSection(state, sectionId) {
  return {
    allowed: Boolean(state.executionEnabled && isSectionApproved(state, sectionId)),
    executionEnabled: Boolean(state.executionEnabled),
    sectionApproved: isSectionApproved(state, sectionId)
  }
}
