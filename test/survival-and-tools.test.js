import test from 'node:test'
import assert from 'node:assert/strict'
import { validTool } from '../src/skills/crafting.js'
import { bestFood } from '../src/safety/survival.js'

function fakeBot(items) {
  return {
    inventory: {
      items: () => items
    }
  }
}

test('golden pickaxe does not satisfy diamond mining tier', () => {
  const bot = fakeBot([
    { name: 'golden_pickaxe' },
    { name: 'wooden_pickaxe' }
  ])

  const tool = validTool(bot, 'pickaxe', { canonical: 'diamond' })
  assert.equal(tool, null)
})

test('iron pickaxe satisfies diamond mining tier', () => {
  const iron = { name: 'iron_pickaxe' }
  const bot = fakeBot([
    { name: 'stone_pickaxe' },
    iron
  ])

  const tool = validTool(bot, 'pickaxe', { canonical: 'diamond' })
  assert.equal(tool, iron)
})

test('Milo prefers strong normal food from available inventory', () => {
  const bot = fakeBot([
    { name: 'apple', count: 3 },
    { name: 'cooked_beef', count: 2 },
    { name: 'bread', count: 5 }
  ])

  assert.equal(bestFood(bot).name, 'cooked_beef')
})
