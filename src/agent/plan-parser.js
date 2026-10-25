import { parseIntent } from './intent.js'

/**
 * Strict, bounded, deterministic multi-step gather commands.
 * Example: "plan get 3 coal then get 2 iron".
 * Unknown steps are rejected as a whole; no partial execution.
 */
export function parseGatherPlan(text) {
  const request = String(text || '').trim().replace(/^plan\s+/i, '')
  const pieces = request.split(/\s+then\s+/i).map(s => s.trim())
  if (pieces.length < 2 || pieces.length > 5 || pieces.some(s => !s)) {
    return { ok: false, error: 'PLAN_STEPS_INVALID' }
  }
  const steps = pieces.map(parseIntent)
  if (steps.some(step => step.type !== 'gather')) {
    return { ok: false, error: 'PLAN_STEP_UNSUPPORTED' }
  }
  return { ok: true, steps }
}
