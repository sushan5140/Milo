function normalizePalette(plan) {
  return (plan?.palette || []).map(p => ({
    block: p.block,
    role: p.role || 'general',
    ratio: Number(p.ratio || 0)
  }))
}

export function diffBuildPlans(previousPlan, nextPlan) {
  if (!previousPlan || !nextPlan) throw new Error('BUILD_PLAN_REQUIRED')

  const changes = []

  for (const field of ['width', 'length']) {
    const before = previousPlan.footprint?.[field]
    const after = nextPlan.footprint?.[field]
    if (before !== after) changes.push({ type: 'dimension', field, before, after })
  }

  if (previousPlan.height !== nextPlan.height) {
    changes.push({ type: 'dimension', field: 'height', before: previousPlan.height, after: nextPlan.height })
  }

  if (previousPlan.style !== nextPlan.style) {
    changes.push({ type: 'style', before: previousPlan.style, after: nextPlan.style })
  }

  const beforePalette = JSON.stringify(normalizePalette(previousPlan))
  const afterPalette = JSON.stringify(normalizePalette(nextPlan))
  if (beforePalette !== afterPalette) {
    changes.push({ type: 'palette', before: normalizePalette(previousPlan), after: normalizePalette(nextPlan) })
  }

  const beforeSections = JSON.stringify(previousPlan.sections || [])
  const afterSections = JSON.stringify(nextPlan.sections || [])
  if (beforeSections !== afterSections) {
    changes.push({ type: 'sections', beforeCount: previousPlan.sections?.length || 0, afterCount: nextPlan.sections?.length || 0 })
  }

  return {
    changed: changes.length > 0,
    changes,
    approvalInvalidated: changes.length > 0,
    summary: changes.length ? `${changes.length} plan changes detected` : 'no plan changes'
  }
}

export function stagePlanRevision(project, candidatePlan) {
  const current = project.design?.plan || null
  const diff = current ? diffBuildPlans(current, candidatePlan) : {
    changed: true,
    changes: [{ type: 'initial-plan' }],
    approvalInvalidated: true,
    summary: 'initial plan'
  }

  project.design ??= {}
  project.design.pendingRevision = {
    plan: candidatePlan,
    diff,
    createdAt: new Date().toISOString()
  }
  return project.design.pendingRevision
}

export function acceptPlanRevision(project) {
  const pending = project.design?.pendingRevision
  if (!pending) throw new Error('NO_PENDING_PLAN_REVISION')

  pending.plan.approved = false
  pending.plan.status = 'draft'
  delete pending.plan.approvedAt

  project.design.plan = pending.plan
  delete project.design.pendingRevision
  project.updatedAt = new Date().toISOString()
  return project.design.plan
}

export function rejectPlanRevision(project) {
  if (!project.design?.pendingRevision) throw new Error('NO_PENDING_PLAN_REVISION')
  delete project.design.pendingRevision
  project.updatedAt = new Date().toISOString()
}
