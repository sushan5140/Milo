function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function now() {
  return new Date().toISOString()
}

export function createProject({ name, description = '' }) {
  const id = normalizeName(name)
  return {
    id,
    name: name.trim(),
    description: description.trim(),
    status: 'active',
    materials: {},
    createdAt: now(),
    updatedAt: now()
  }
}

export function addMaterial(project, resource, amount) {
  const key = resource.canonical
  const current = project.materials[key] || {
    canonical: key,
    display: resource.display || key.replaceAll('_', ' '),
    target: 0,
    delivered: 0,
    resource
  }

  current.target += amount
  current.resource = resource
  project.materials[key] = current
  project.updatedAt = now()
  return project
}

export function recordProjectDelivery(project, resource, amount) {
  const key = resource.canonical
  const material = project.materials[key]
  if (!material) return project

  material.delivered = Math.min(material.target, material.delivered + Math.max(0, amount))
  project.updatedAt = now()

  if (projectDeficits(project).length === 0) {
    project.status = 'materials_ready'
  }

  return project
}

export function projectDeficits(project) {
  return Object.values(project.materials)
    .map(material => ({
      ...material,
      missing: Math.max(0, material.target - material.delivered)
    }))
    .filter(material => material.missing > 0)
    .sort((a, b) => b.missing - a.missing)
}

export function nextProjectDeficit(project) {
  return projectDeficits(project)[0] || null
}

export function projectProgress(project) {
  const materials = Object.values(project.materials)
  const target = materials.reduce((sum, item) => sum + item.target, 0)
  const delivered = materials.reduce((sum, item) => sum + Math.min(item.delivered, item.target), 0)

  return {
    target,
    delivered,
    percent: target === 0 ? 0 : Math.round((delivered / target) * 100),
    deficits: projectDeficits(project)
  }
}

export function summarizeProject(project) {
  const progress = projectProgress(project)

  if (progress.target === 0) {
    return `${project.name}: no materials set yet.`
  }

  const missing = progress.deficits
    .slice(0, 4)
    .map(item => `${item.missing} ${item.display}`)
    .join(', ')

  return `${project.name}: ${progress.percent}% materials ready (${progress.delivered}/${progress.target}).${missing ? ` missing ${missing}.` : ' all listed materials are ready.'}`
}

export function findProject(projects, name) {
  const wanted = normalizeName(name)
  return Object.values(projects || {}).find(project => project.id === wanted || normalizeName(project.name) === wanted) || null
}
