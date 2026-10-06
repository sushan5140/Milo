import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createProject,
  addMaterial,
  recordProjectDelivery,
  nextProjectDeficit,
  projectProgress,
  findProject
} from '../src/projects/project.js'

const coal = { canonical: 'coal', display: 'coal', blocks: ['coal_ore'], drops: ['coal'] }
const spruce = { canonical: 'spruce_log', display: 'spruce logs', blocks: ['spruce_log'], drops: ['spruce_log'] }

test('project ids are safe slugs', () => {
  const project = createProject({ name: 'Base v1.2!' })
  assert.equal(project.id, 'base-v12')
})

test('project progress tracks verified delivery only', () => {
  const project = createProject({ name: 'Village' })
  addMaterial(project, spruce, 100)
  addMaterial(project, coal, 20)

  recordProjectDelivery(project, spruce, 40)

  const progress = projectProgress(project)
  assert.equal(progress.target, 120)
  assert.equal(progress.delivered, 40)
  assert.equal(progress.percent, 33)
})

test('next deficit chooses the largest missing material', () => {
  const project = createProject({ name: 'Village' })
  addMaterial(project, spruce, 100)
  addMaterial(project, coal, 20)
  recordProjectDelivery(project, spruce, 90)

  const next = nextProjectDeficit(project)
  assert.equal(next.canonical, 'coal')
  assert.equal(next.missing, 20)
})

test('delivery is capped at the material target', () => {
  const project = createProject({ name: 'Storage' })
  addMaterial(project, coal, 10)
  recordProjectDelivery(project, coal, 100)

  assert.equal(project.materials.coal.delivered, 10)
  assert.equal(project.status, 'materials_ready')
})

test('project lookup supports human project names', () => {
  const project = createProject({ name: 'Japanese House' })
  const found = findProject({ [project.id]: project }, 'japanese house')
  assert.equal(found.id, project.id)
})
