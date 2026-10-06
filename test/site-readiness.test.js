import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeBuildSite } from '../src/building/site-preflight.js'
import { doorBlockSpecs, slabBlockSpec, stairBlockSpec } from '../src/building/fidelity.js'
import { inventoryReadiness } from '../src/building/readiness.js'
import { diffRollbackSnapshot } from '../src/building/rollback-preview.js'

function posKey(p){ return `${p.x},${p.y},${p.z}` }
function botWith(map={}, items=[], entities={}) {
  return {
    entity: { position: { x: 999, y: 999, z: 999 } },
    entities,
    inventory: { items: () => items },
    blockAt(pos) { return { name: map[posKey(pos)] || 'stone' } }
  }
}

test('door slab and stair specs expose block state metadata', () => {
  const door = doorBlockSpecs('spruce_door', 'north', 'left')
  assert.equal(door.upper.state.half, 'upper')
  const slab = slabBlockSpec('stone_brick_slab', 'top', 'floor')
  assert.equal(slab.state.type, 'top')
  const stair = stairBlockSpec('spruce_stairs', { facing: 'east', half: 'bottom', shape: 'straight', role: 'roof' })
  assert.equal(stair.state.facing, 'east')
  assert.equal(stair.role, 'roof')
})

test('site preflight flags liquid foundation support', () => {
  const project = {
    site: { x: 0, y: 64, z: 0 },
    design: { plan: { footprint: { width: 2, length: 2 } } }
  }
  const result = analyzeBuildSite(botWith({ '0,63,0': 'water' }), project)
  assert.equal(result.safe, false)
  assert.ok(result.liquids > 0)
})

test('inventory readiness reports missing dry-run blocks', () => {
  const project = {
    buildSafety: {
      lastManifest: {
        sectionId: 'walls',
        actions: [
          { action: 'would_place', expected: 'spruce_planks' },
          { action: 'would_place', expected: 'spruce_planks' },
          { action: 'skip', expected: 'spruce_planks' }
        ]
      }
    }
  }
  const result = inventoryReadiness(botWith({}, [{ name: 'spruce_planks', count: 1 }]), project, 'walls')
  assert.equal(result.complete, false)
  assert.equal(result.missing.spruce_planks, 1)
})

test('rollback preview compares snapshot with manifest', () => {
  const snapshot = {
    id: 'snap-1',
    positions: [
      { x: 1, y: 2, z: 3, before: { name: 'air' } }
    ]
  }
  const manifest = {
    sectionId: 'walls',
    actions: [
      { x: 1, y: 2, z: 3, expected: 'spruce_planks', action: 'would_place', reason: null }
    ]
  }
  const result = diffRollbackSnapshot(snapshot, manifest)
  assert.equal(result.compared, 1)
  assert.equal(result.wouldChange, 1)
  assert.equal(result.readOnly, true)
})
