export function diffRollbackSnapshot(snapshot, manifest) {
  if (!snapshot || !manifest) throw new Error('ROLLBACK_AND_MANIFEST_REQUIRED')

  const beforeByPos = new Map(
    (snapshot.positions || []).map(p => [`${p.x},${p.y},${p.z}`, p.before || null])
  )

  const changes = []
  for (const action of manifest.actions || []) {
    const key = `${action.x},${action.y},${action.z}`
    if (!beforeByPos.has(key)) continue
    const before = beforeByPos.get(key)
    changes.push({
      x: action.x,
      y: action.y,
      z: action.z,
      before,
      proposed: action.expected,
      action: action.action,
      reason: action.reason
    })
  }

  return {
    snapshotId: snapshot.id,
    sectionId: manifest.sectionId,
    compared: changes.length,
    wouldChange: changes.filter(c => c.action === 'would_place').length,
    blocked: changes.filter(c => c.action === 'blocked').length,
    alreadyCorrect: changes.filter(c => c.action === 'skip').length,
    changes,
    readOnly: true
  }
}

export function summarizeRollbackPreview(result) {
  return `rollback preview: ${result.compared} positions, ${result.wouldChange} would change, ${result.blocked} blocked, ${result.alreadyCorrect} already correct.`
}
