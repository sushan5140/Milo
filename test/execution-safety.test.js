import test from 'node:test'
import assert from 'node:assert/strict'
import { expandCraftDependencies, roofBlockSpec } from '../src/building/fidelity.js'
import { diffBuildPlans, stagePlanRevision, acceptPlanRevision, rejectPlanRevision } from '../src/building/plan-diff.js'
import {
  createBuildSafetyState,
  addProtectedZone,
  isProtectedPosition,
  approveBuildSection,
  revokeBuildSectionApproval,
  canExecuteSection,
  createRollbackSnapshot,
  recordRollbackSnapshot
} from '../src/building/execution-safety.js'

test('crafted blocks expand to underlying raw inputs', () => {
  const out = expandCraftDependencies({
    spruce_stairs: 8,
    stone_brick_slab: 12
  })
  assert.ok(out.raw.spruce_log > 0)
  assert.ok(out.raw.stone > 0)
  assert.ok(out.crafted.spruce_stairs >= 8)
})

test('roof stair spec carries orientation state', () => {
  const spec = roofBlockSpec('spruce_stairs', 'left')
  assert.equal(spec.state.facing, 'east')
  assert.equal(spec.state.half, 'bottom')
})

test('plan diff invalidates approval when geometry changes', () => {
  const a = { footprint: { width: 10, length: 10 }, height: 6, style: 'japanese', palette: [], sections: [] }
  const b = { footprint: { width: 12, length: 10 }, height: 6, style: 'japanese', palette: [], sections: [] }
  const diff = diffBuildPlans(a, b)
  assert.equal(diff.changed, true)
  assert.equal(diff.approvalInvalidated, true)
})

test('staged revisions can be accepted or rejected', () => {
  const project = { design: { plan: { footprint: { width: 10, length: 10 }, height: 6, style: 'a', palette: [], sections: [], approved: true } } }
  const candidate = { footprint: { width: 12, length: 10 }, height: 6, style: 'a', palette: [], sections: [], approved: true, status: 'approved' }
  stagePlanRevision(project, candidate)
  assert.ok(project.design.pendingRevision)
  const accepted = acceptPlanRevision(project)
  assert.equal(accepted.approved, false)
  assert.equal(project.design.pendingRevision, undefined)

  stagePlanRevision(project, candidate)
  rejectPlanRevision(project)
  assert.equal(project.design.pendingRevision, undefined)
})

test('protected zones detect contained positions', () => {
  const state = createBuildSafetyState()
  addProtectedZone(state, {
    name: 'home',
    min: { x: 0, y: 60, z: 0 },
    max: { x: 10, y: 80, z: 10 },
    dimension: 'overworld'
  })
  assert.equal(isProtectedPosition(state, { x: 5, y: 64, z: 5 }, 'overworld'), true)
  assert.equal(isProtectedPosition(state, { x: 20, y: 64, z: 20 }, 'overworld'), false)
})

test('section approval alone cannot unlock disabled executor', () => {
  const state = createBuildSafetyState()
  approveBuildSection(state, 'walls', 'owner')
  let gate = canExecuteSection(state, 'walls')
  assert.equal(gate.sectionApproved, true)
  assert.equal(gate.executionEnabled, false)
  assert.equal(gate.allowed, false)

  revokeBuildSectionApproval(state, 'walls')
  gate = canExecuteSection(state, 'walls')
  assert.equal(gate.sectionApproved, false)
})

test('rollback snapshots persist metadata', () => {
  const state = createBuildSafetyState()
  const snap = createRollbackSnapshot({
    projectId: 'house',
    sectionId: 'walls',
    positions: [{ x: 1, y: 2, z: 3, before: { name: 'air' } }]
  })
  recordRollbackSnapshot(state, snap)
  assert.equal(state.rollbackLog.length, 1)
  assert.equal(state.rollbackLog[0].applied, false)
})
