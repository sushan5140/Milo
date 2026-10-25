import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGatherPlan } from '../src/agent/plan-parser.js'

test('parses ordered resource goals', () => {
  const result = parseGatherPlan('plan get 3 coal then collect 2 iron')
  assert.equal(result.ok, true)
  assert.deepEqual(result.steps.map(x => [x.resource.canonical, x.amount]), [['coal', 3], ['iron', 2]])
})
test('rejects unknown steps without partial approval', () => {
  assert.equal(parseGatherPlan('get 3 coal then teleport home').ok, false)
})
test('limits the number of steps', () => {
  assert.equal(parseGatherPlan('get 1 coal then get 1 coal then get 1 coal then get 1 coal then get 1 coal then get 1 coal').ok, false)
})
test('rejects single step and empty steps', () => {
  assert.equal(parseGatherPlan('get 2 iron').ok, false)
  assert.equal(parseGatherPlan('get 2 iron then ').ok, false)
})
