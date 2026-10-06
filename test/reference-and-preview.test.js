import test from 'node:test'
import assert from 'node:assert/strict'
import { observationsToBuildPlan } from '../src/building/reference-adapter.js'
import { footprintCorners, footprintPoints } from '../src/building/preview.js'
import { setBuildPalette, replacePaletteBlock } from '../src/building/plan.js'

test('reference observations become a build plan', () => {
  const plan = observationsToBuildPlan({
    width: 18,
    length: 24,
    height: 9,
    style: 'japanese',
    confidence: 0.82
  })

  assert.equal(plan.footprint.width, 18)
  assert.equal(plan.footprint.length, 24)
  assert.equal(plan.height, 9)
  assert.equal(plan.style, 'japanese')
  assert.ok(plan.palette.length > 0)
  assert.ok(plan.sections.some(s => s.kind === 'roof'))
  assert.equal(plan.reference.confidence, 0.82)
})

test('palette edit resets approval and re-estimates materials', () => {
  const plan = observationsToBuildPlan({ width: 10, length: 10, height: 6, style: 'modern' })
  plan.approved = true
  plan.status = 'approved'

  setBuildPalette(plan, [
    { block: 'spruce_planks', ratio: 70 },
    { block: 'stone_bricks', ratio: 30 }
  ])

  assert.equal(plan.approved, false)
  assert.equal(plan.status, 'draft')
  assert.ok(plan.materials.spruce_planks > plan.materials.stone_bricks)
})

test('palette replacement changes only the requested block', () => {
  const plan = observationsToBuildPlan({ width: 10, length: 10, height: 6, style: 'japanese' })
  const old = plan.palette[0].block
  replacePaletteBlock(plan, old, 'birch_planks')
  assert.equal(plan.palette[0].block, 'birch_planks')
})

test('footprint corners are derived from project site and dimensions', () => {
  const corners = footprintCorners(
    { x: 100, y: 64, z: 200 },
    { width: 10, length: 20 }
  )
  assert.deepEqual(corners, [
    { x: 100, y: 64, z: 200 },
    { x: 109, y: 64, z: 200 },
    { x: 109, y: 64, z: 219 },
    { x: 100, y: 64, z: 219 }
  ])
})

test('footprint perimeter contains no interior points', () => {
  const points = footprintPoints(
    { x: 0, y: 70, z: 0 },
    { width: 4, length: 3 }
  )
  assert.equal(points.length, 10)
  assert.equal(points.some(p => p.x === 1 && p.z === 1), false)
})
