import test from 'node:test'
import assert from 'node:assert/strict'
import { assertEmptySmeltingSlots } from '../src/skills/smelting.js'
import { withRetries } from '../src/safety/retry.js'

const furnace = (input, output) => ({
  inputItem: () => input,
  outputItem: () => output
})

test('smelting accepts an empty furnace (existing fuel allowed)', () => {
  assert.doesNotThrow(() => assertEmptySmeltingSlots(furnace(null, null)))
})
test('smelting rejects already inserted input to prevent duplicate submission', () => {
  assert.throws(() => assertEmptySmeltingSlots(furnace({ name: 'raw_iron', count: 8 }, null)), /FURNACE_BUSY/)
})
test('smelting rejects existing output so it is not mistaken for ours', () => {
  assert.throws(() => assertEmptySmeltingSlots(furnace(null, { name: 'iron_ingot', count: 8 })), /FURNACE_BUSY/)
})
test('an uncertain smelt timeout must never re-run an operation', async () => {
  let calls = 0
  await assert.rejects(withRetries(async () => {
    calls += 1
    throw new Error('SMELT_TIMEOUT')
  }, { attempts: 3, delayMs: 1 }), /SMELT_TIMEOUT/)
  assert.equal(calls, 1)
})
