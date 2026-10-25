import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlan, recordPlanResult, currentPlanStep } from '../src/agent/plan-state.js'

const steps = [
  { type: 'gather', resource: { canonical: 'coal' }, amount: 3 },
  { type: 'gather', resource: { canonical: 'iron' }, amount: 2 }
]
test('only verified completion advances', () => {
  const plan = createPlan(steps, 'demo')
  const failed = recordPlanResult(plan, { complete: true, verification: { complete: false } })
  assert.equal(failed.nextStep, 0)
  assert.equal(failed.status, 'paused')
  const ok = recordPlanResult(failed, { complete: true, verification: { complete: true } })
  assert.equal(ok.nextStep, 1)
  assert.equal(ok.status, 'pending')
})
test('completion advances once and halts further execution', () => {
  const first = recordPlanResult(createPlan(steps, 'demo'), { complete: true, verification: { complete: true } })
  const done = recordPlanResult(first, { complete: true, verification: { complete: true } })
  assert.equal(done.status, 'completed')
  assert.equal(currentPlanStep(done), null)
  assert.throws(() => recordPlanResult(done, { complete: true, verification: { complete: true } }), /PLAN_NOT_ACTIVE/)
})
test('invalid plans are rejected', () => assert.throws(() => createPlan([]), /PLAN_STEPS_INVALID/))
