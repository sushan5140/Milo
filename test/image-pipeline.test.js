import test from 'node:test'
import assert from 'node:assert/strict'
import { createImageReference, analyzeReferenceImage, createVisionAnalyzer } from '../src/building/image-ingest.js'
import { observationsToBuildPlan } from '../src/building/reference-adapter.js'
import { generateStructureLayers, flattenExpectedBlocks } from '../src/building/geometry.js'
import { syncPlanMaterialsToProject } from '../src/building/material-sync.js'
import { verifyPlanAgainstWorld } from '../src/building/world-verifier.js'

test('image reference accepts http urls', () => {
  const ref = createImageReference({ source: 'https://example.com/house.png' })
  assert.equal(ref.kind, 'url')
})

test('pluggable analyzer returns observations', async () => {
  const analyzer = createVisionAnalyzer({
    analyze: async () => ({ width: 12, length: 16, height: 7, style: 'japanese' })
  })
  const ref = createImageReference({ source: 'https://example.com/house.png' })
  const out = await analyzeReferenceImage(ref, analyzer)
  assert.equal(out.style, 'japanese')
})

test('geometry includes door opening and pitched roof', () => {
  const plan = observationsToBuildPlan({ width: 10, length: 12, height: 7, style: 'japanese' })
  const layers = generateStructureLayers(plan)
  assert.ok(layers.openings.some(o => o.kind === 'door'))
  assert.equal(layers.roof.style, 'pitched')
  assert.ok(layers.roof.blocks.length > 0)
})

test('plan materials can sync into project resources', () => {
  const project = { materials: {}, design: {}, updatedAt: null }
  const plan = observationsToBuildPlan({
    width: 8,
    length: 8,
    height: 5,
    palette: [
      { block: 'spruce_planks', role: 'walls', ratio: 0.7 },
      { block: 'cobblestone', role: 'foundation', ratio: 0.3 }
    ]
  })

  const fakeParse = text => {
    const amount = Number(text.match(/get (\d+)/)?.[1] || 1)
    const requested = text.split(' ').slice(2).join(' ')
    const canonical = requested === 'spruce' ? 'spruce_log' : requested
    return {
      type: 'gather',
      amount,
      resource: { canonical, display: requested, blocks: [], drops: [canonical] }
    }
  }

  const result = syncPlanMaterialsToProject(project, plan, fakeParse)
  assert.ok(result.bill.length >= 2)
  assert.ok(project.materials.spruce_log)
  assert.ok(project.materials.cobblestone)
})

test('world verifier is read-only and reports mismatches', () => {
  const plan = observationsToBuildPlan({
    width: 4,
    length: 4,
    height: 4,
    palette: [{ block: 'cobblestone', role: 'general', ratio: 1 }]
  })
  const site = { x: 0, y: 64, z: 0 }
  const expected = flattenExpectedBlocks(plan, site)

  const bot = {
    blockAt: () => ({ name: 'air' })
  }

  const result = verifyPlanAgainstWorld(bot, plan, site, { sampleLimit: expected.length })
  assert.equal(result.readOnly, true)
  assert.ok(result.mismatches.length > 0)
  assert.equal(result.matches, 0)
})
