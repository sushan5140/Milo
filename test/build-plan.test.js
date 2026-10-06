import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBuildPlan,
  estimateMaterials,
  approveBuildPlan,
  reviseBuildPlan
} from '../src/building/plan.js'

test('creates a draft build plan', () => {
  const plan = createBuildPlan({ width: 12, length: 16, height: 7, style: 'japanese' })
  assert.equal(plan.status, 'draft')
  assert.equal(plan.approved, false)
  assert.deepEqual(plan.footprint, { width: 12, length: 16 })
})

test('material estimate is deterministic and non-empty', () => {
  const plan = createBuildPlan({
    width: 10,
    length: 10,
    height: 5,
    palette: [
      { block: 'spruce_planks', ratio: 0.7 },
      { block: 'stone_bricks', ratio: 0.3 }
    ]
  })
  const materials = estimateMaterials(plan)
  assert.ok(materials.spruce_planks > materials.stone_bricks)
  assert.ok(Object.values(materials).reduce((a,b)=>a+b,0) > 0)
})

test('revision revokes approval', () => {
  const plan = createBuildPlan({ width: 8, length: 8, height: 6 })
  approveBuildPlan(plan)
  assert.equal(plan.approved, true)
  reviseBuildPlan(plan, { width: 12 })
  assert.equal(plan.approved, false)
  assert.equal(plan.status, 'draft')
  assert.equal(plan.footprint.width, 12)
})

test('invalid dimensions are rejected', () => {
  assert.throws(() => createBuildPlan({ width: 0, length: 10, height: 5 }), /INVALID_WIDTH/)
})
