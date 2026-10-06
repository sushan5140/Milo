import test from 'node:test'
import assert from 'node:assert/strict'
import vec3 from 'vec3'
import { gatherResource } from '../src/skills/gathering.js'
import { createProject, addMaterial, recordProjectDelivery } from '../src/projects/project.js'
import { syncPlanMaterialsToProject } from '../src/building/material-sync.js'
import { analyzeBuildSite } from '../src/building/site-preflight.js'

const { Vec3 } = vec3

test('gathering stops at a bounded loop limit when drops never arrive', async () => {
  const target = new Vec3(1, 64, 1)
  let digs = 0
  const bot = {
    health: 20,
    food: 20,
    inventory: { items: () => [] },
    findBlocks: () => [target],
    blockAt: pos => ({ name: 'dirt', position: pos }),
    canDigBlock: () => true,
    dig: async () => { digs += 1 },
    pathfinder: { goto: async () => {} },
    entity: { position: new Vec3(0, 64, 0) },
    entities: {}
  }

  const mcData = { blocksByName: { dirt: { id: 1 } } }
  const resource = { canonical: 'dirt', blocks: ['dirt'], drops: ['dirt'] }
  const result = await gatherResource({ bot, mcData, resource, amount: 1 })
  assert.equal(result.complete, false)
  assert.equal(result.searchLimitReached, true)
  assert.ok(digs <= 40)
})

test('adding a new deficit reopens materials-ready projects', () => {
  const coal = { canonical: 'coal', display: 'coal', blocks: ['coal_ore'], drops: ['coal'] }
  const project = createProject({ name: 'Mine' })
  addMaterial(project, coal, 5)
  recordProjectDelivery(project, coal, 5)
  assert.equal(project.status, 'materials_ready')
  addMaterial(project, coal, 2)
  assert.equal(project.status, 'active')
})

test('plan material resync preserves verified delivered progress', () => {
  const project = {
    materials: {
      spruce_log: {
        canonical: 'spruce_log',
        display: 'spruce logs',
        target: 20,
        delivered: 12,
        resource: { canonical: 'spruce_log', display: 'spruce logs', blocks: [], drops: ['spruce_log'] },
        sources: []
      }
    },
    design: {},
    status: 'active',
    stage: 'materials'
  }
  const plan = { materials: { spruce_planks: 40 } }
  const parseIntent = text => ({
    type: 'gather',
    amount: Number(text.match(/get (\d+)/)?.[1] || 1),
    resource: { canonical: 'spruce_log', display: 'spruce logs', blocks: [], drops: ['spruce_log'] }
  })

  syncPlanMaterialsToProject(project, plan, parseIntent)
  assert.equal(project.materials.spruce_log.delivered, 10)
  assert.equal(project.materials.spruce_log.target, 10)
  assert.equal(project.status, 'materials_ready')
})

test('site preflight detects uneven terrain', () => {
  const map = new Map()
  const key = (x,y,z) => `${x},${y},${z}`
  for (let x = 0; x < 2; x += 1) {
    for (let z = 0; z < 2; z += 1) {
      map.set(key(x, 63 + (x === 1 ? 2 : 0), z), 'stone')
    }
  }
  const bot = {
    entities: {},
    entity: { position: new Vec3(99,99,99) },
    blockAt(pos) {
      const name = map.get(key(pos.x,pos.y,pos.z)) || 'air'
      return { name }
    }
  }
  const project = {
    site: { x: 0, y: 64, z: 0 },
    design: { plan: { footprint: { width: 2, length: 2 } } }
  }
  const result = analyzeBuildSite(bot, project)
  assert.equal(result.safe, false)
  assert.ok(result.levelVariance > 1)
})
