import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIntent, supportedResources } from '../src/agent/intent.js'

test('parses a finished iron request', () => {
  const intent = parseIntent('get me 25 iron')
  assert.equal(intent.type, 'gather')
  assert.equal(intent.amount, 25)
  assert.equal(intent.resource.canonical, 'iron')
  assert.equal(intent.resource.process, 'smelt')
  assert.deepEqual(intent.resource.finished, ['iron_ingot'])
})

test('keeps raw iron raw when explicitly requested', () => {
  const intent = parseIntent('bring me 12 raw iron')
  assert.equal(intent.type, 'gather')
  assert.equal(intent.amount, 12)
  assert.equal(intent.resource.canonical, 'raw_iron')
  assert.equal(intent.resource.process, undefined)
})

test('parses plural diamonds', () => {
  const intent = parseIntent('get me 3 diamonds please')
  assert.equal(intent.type, 'gather')
  assert.equal(intent.amount, 3)
  assert.equal(intent.resource.canonical, 'diamond')
})

test('reports unknown resources instead of inventing a plan', () => {
  const intent = parseIntent('get me 8 unobtainium')
  assert.equal(intent.type, 'unknown_resource')
  assert.equal(intent.requested, 'unobtainium')
})

test('caps unreasonable quantities', () => {
  const intent = parseIntent('collect 99999 coal')
  assert.equal(intent.amount, 2304)
})

test('exposes human-facing resource names', () => {
  const resources = supportedResources()
  assert.ok(resources.includes('iron'))
  assert.ok(resources.includes('raw iron'))
  assert.ok(resources.includes('diamond'))
})
