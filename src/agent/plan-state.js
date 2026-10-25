// Pure state transitions: a plan advances only after independently verified success.
export function createPlan(steps, id = `plan-${Date.now()}`) {
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 5 ||
      steps.some(step => step?.type !== 'gather')) {
    throw new Error('PLAN_STEPS_INVALID')
  }
  return { id, steps, nextStep: 0, status: 'pending', results: [] }
}

export function currentPlanStep(plan) {
  if (!plan || plan.status === 'completed') return null
  return plan.steps[plan.nextStep] ?? null
}

export function recordPlanResult(plan, result) {
  if (!currentPlanStep(plan)) throw new Error('PLAN_NOT_ACTIVE')
  if (plan.status === 'cancelled') throw new Error('PLAN_CANCELLED')
  const verified = result?.complete === true && result?.verification?.complete === true
  if (!verified) {
    return { ...plan, status: 'paused', failure: 'STEP_NOT_VERIFIED' }
  }
  const nextStep = plan.nextStep + 1
  return {
    ...plan,
    nextStep,
    status: nextStep === plan.steps.length ? 'completed' : 'pending',
    failure: null,
    results: [...plan.results, { step: plan.nextStep, verified: true }]
  }
}
