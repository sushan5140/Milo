import { countItems } from '../world/inventory.js'

export function verifyHeldGoal(bot, itemNames, requested) {
  const actual = countItems(bot, itemNames)
  return {
    target: requested,
    actual,
    complete: actual >= requested,
    missing: Math.max(0, requested - actual)
  }
}

export function verifyDepositDelta({ before, after, requested }) {
  const delta = Math.max(0, after - before)
  return {
    target: requested,
    before,
    after,
    delta,
    complete: delta >= requested,
    missing: Math.max(0, requested - delta)
  }
}

export function summarizeVerification(verification) {
  if (verification.complete) return `verified ${verification.target}/${verification.target}`
  const actual = verification.delta ?? verification.actual ?? 0
  return `verified ${actual}/${verification.target}; missing ${verification.missing}`
}
