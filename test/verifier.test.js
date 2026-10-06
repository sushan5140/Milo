import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyDepositDelta, summarizeVerification } from '../src/agent/verifier.js'

test('deposit verification succeeds only when full requested delta appears', () => {
  const v = verifyDepositDelta({ before: 10, after: 35, requested: 25 })
  assert.equal(v.complete, true)
  assert.equal(v.delta, 25)
  assert.equal(v.missing, 0)
})

test('partial deposit remains incomplete against original target', () => {
  const v = verifyDepositDelta({ before: 10, after: 22, requested: 25 })
  assert.equal(v.complete, false)
  assert.equal(v.delta, 12)
  assert.equal(v.missing, 13)
  assert.match(summarizeVerification(v), /missing 13/)
})

test('preexisting storage items do not count as newly delivered items', () => {
  const v = verifyDepositDelta({ before: 64, after: 70, requested: 20 })
  assert.equal(v.delta, 6)
  assert.equal(v.complete, false)
})
