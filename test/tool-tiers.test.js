import test from 'node:test'
import assert from 'node:assert/strict'
import { validTool } from '../src/skills/crafting.js'

const resource = canonical => ({ canonical })
const botWith = (...names) => ({ inventory: { items: () => names.map(name => ({ name })) } })

test('gold and wood cannot mine diamond even when they are the only pickaxes', () => {
  assert.equal(validTool(botWith('golden_pickaxe', 'wooden_pickaxe'), 'pickaxe', resource('diamond')), null)
})
test('stone is sufficient for iron but not diamond', () => {
  const bot = botWith('stone_pickaxe')
  assert.equal(validTool(bot, 'pickaxe', resource('iron'))?.name, 'stone_pickaxe')
  assert.equal(validTool(bot, 'pickaxe', resource('diamond')), null)
})
test('iron is sufficient for diamond, redstone and gold', () => {
  const bot = botWith('golden_pickaxe', 'iron_pickaxe')
  for (const name of ['diamond', 'redstone', 'gold']) {
    assert.equal(validTool(bot, 'pickaxe', resource(name))?.name, 'iron_pickaxe')
  }
})
test('unknown tool names are rejected and valid highest tier selected', () => {
  const bot = botWith('not_a_pickaxe', 'stone_pickaxe', 'diamond_pickaxe')
  assert.equal(validTool(bot, 'pickaxe', resource('iron'))?.name, 'diamond_pickaxe')
})
