import test from 'node:test'
import assert from 'node:assert/strict'
import { immediateEnvironmentRisk, nearestHostile } from '../src/safety/danger.js'

function fakeBot({ entities = {}, self = { position: { distanceTo: () => 0 } }, oxygenLevel = 20 } = {}) {
  return {
    entities,
    entity: self,
    oxygenLevel
  }
}

test('detects nearby hostile mobs', () => {
  const self = { position: { distanceTo: () => 0 } }
  const zombie = {
    name: 'zombie',
    position: { distanceTo: () => 4 }
  }
  const bot = fakeBot({ entities: { a: zombie }, self })
  const hostile = nearestHostile(bot, 8)
  assert.equal(hostile.name, 'zombie')
  assert.equal(hostile.distance, 4)
})

test('detects low oxygen drowning risk', () => {
  const bot = fakeBot({
    self: { isInWater: true, position: { distanceTo: () => 0 } },
    oxygenLevel: 5
  })
  assert.equal(immediateEnvironmentRisk(bot).code, 'DROWNING_RISK')
})

test('detects active fire/lava risk', () => {
  const bot = fakeBot({
    self: { isInLava: true, onFire: false, position: { distanceTo: () => 0 } }
  })
  assert.equal(immediateEnvironmentRisk(bot).code, 'FIRE_RISK')
})
