export function footprintPoints(site, footprint) {
  if (!site) throw new Error('PROJECT_SITE_MISSING')
  if (!footprint?.width || !footprint?.length) throw new Error('INVALID_FOOTPRINT')

  const x0 = site.x
  const z0 = site.z
  const y = site.y
  const x1 = x0 + footprint.width - 1
  const z1 = z0 + footprint.length - 1

  const points = []
  for (let x = x0; x <= x1; x += 1) points.push({ x, y, z: z0 })
  for (let z = z0 + 1; z <= z1; z += 1) points.push({ x: x1, y, z })
  for (let x = x1 - 1; x >= x0; x -= 1) points.push({ x, y, z: z1 })
  for (let z = z1 - 1; z > z0; z -= 1) points.push({ x: x0, y, z })

  return points
}

export function footprintCorners(site, footprint) {
  if (!site) throw new Error('PROJECT_SITE_MISSING')
  const { width, length } = footprint
  return [
    { x: site.x, y: site.y, z: site.z },
    { x: site.x + width - 1, y: site.y, z: site.z },
    { x: site.x + width - 1, y: site.y, z: site.z + length - 1 },
    { x: site.x, y: site.y, z: site.z + length - 1 }
  ]
}
