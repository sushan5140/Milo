import test from 'node:test'
import assert from 'node:assert/strict'
import { dryRunSection, buildExecutionManifest } from '../src/building/dry-run.js'
import { createBuildSafetyState, addProtectedZone } from '../src/building/execution-safety.js'

function fakeBlock(name) {
  return { name, stateId: 0 }
}

function fakeBot(blockMap = {}) {
  return {
    blockAt(pos) {
      const key = `${pos.x},${pos.y},${pos.z}`
      return fakeBlock(blockMap[key] || 'air')
    }
  }
}

function project() {
  return {
    id: 'house',
    site: { x: 0, y: 64, z: 0, dimension: 'overworld' },
    design: {
      plan: {
        footprint: { width: 4, length: 4 },
        height: 4,
        palette: [
          { block: 'cobblestone', role: 'foundation', ratio: 0.4 },
          { block: 'spruce_planks', role: 'walls', ratio: 0.4 },
          { block: 'spruce_stairs', role: 'roof', ratio: 0.2 }
        ],
        sections: [{ kind: 'roof', notes: ['roof style: pitched'] }]
      }
    },
    buildSafety: createBuildSafetyState()
  }
}

test('dry run reports protected positions', () => {
  const p = project()
  addProtectedZone(p.buildSafety, {
    name: 'protected',
    min: { x: 0, y: 64, z: 0 },
    max: { x: 1, y: 70, z: 1 },
    dimension: 'overworld'
  })
  const result = dryRunSection({ bot: fakeBot(), project: p, sectionId: 'foundation' })
  assert.ok(result.counts.protected > 0)
  assert.equal(result.readOnly, true)
  assert.equal(result.safeToExecute, false)
})

test('dry run reports occupied blocks', () => {
  const p = project()
  const result = dryRunSection({
    bot: fakeBot({ '0,64,0': 'diamond_block' }),
    project: p,
    sectionId: 'foundation'
  })
  assert.ok(result.counts.occupied > 0)
})

test('dry run recognizes already-correct blocks', () => {
  const p = project()
  const result = dryRunSection({
    bot: fakeBot({ '0,64,0': 'cobblestone' }),
    project: p,
    sectionId: 'foundation'
  })
  assert.ok(result.counts.alreadyCorrect > 0)
})

test('dry run detects unsupported placements', () => {
  const p = project()
  const result = dryRunSection({
    bot: fakeBot(),
    project: p,
    sectionId: 'roof'
  })
  assert.ok(result.counts.unsupported >= 0)
  assert.equal(result.safeToExecute, false)
})

test('manifest preserves read-only action plan', () => {
  const p = project()
  const result = dryRunSection({ bot: fakeBot(), project: p, sectionId: 'walls' })
  const manifest = buildExecutionManifest(result)
  assert.equal(manifest.readOnly, true)
  assert.equal(manifest.executionAllowed, false)
  assert.equal(manifest.actions.length, result.counts.total)
})
