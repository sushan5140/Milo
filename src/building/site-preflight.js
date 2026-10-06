import vec3 from 'vec3'
import { footprintPoints } from './preview.js'

const { Vec3 } = vec3
const LIQUIDS = new Set(['water','lava'])
const PASSABLE = new Set(['air','cave_air','void_air','grass','tall_grass','fern','snow','vine'])

function columnGroundY(bot, x, z, expectedGroundY, scan = 4) {
  for (let y = expectedGroundY + scan; y >= expectedGroundY - scan; y -= 1) {
    const block = bot.blockAt(new Vec3(x, y, z))
    if (!block) continue
    if (!PASSABLE.has(block.name) && !LIQUIDS.has(block.name)) return y
  }
  return null
}

export function analyzeBuildSite(bot, project, { clearance = 2 } = {}) {
  if (!project?.site) throw new Error('PROJECT_SITE_MISSING')
  if (!project?.design?.plan) throw new Error('BUILD_PLAN_MISSING')

  const { width, length } = project.design.plan.footprint
  const site = project.site
  const heights = []
  let liquids = 0
  let blockedClearance = 0
  let unknown = 0
  let entityCount = 0

  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < length; z += 1) {
      const wx = site.x + x
      const wz = site.z + z
      const ground = bot.blockAt(new Vec3(wx, site.y - 1, wz))
      if (!ground) {
        unknown += 1
        continue
      }
      if (LIQUIDS.has(ground.name)) liquids += 1
      const actualGroundY = columnGroundY(bot, wx, wz, site.y - 1)
      if (actualGroundY === null) unknown += 1
      else heights.push(actualGroundY)

      for (let dy = 0; dy <= clearance; dy += 1) {
        const b = bot.blockAt(new Vec3(wx, site.y + dy, wz))
        if (!b) {
          unknown += 1
          continue
        }
        if (!PASSABLE.has(b.name) && !LIQUIDS.has(b.name)) blockedClearance += 1
      }
    }
  }

  for (const entity of Object.values(bot.entities || {})) {
    if (!entity?.position || entity === bot.entity) continue
    const p = entity.position
    if (
      p.x >= site.x && p.x < site.x + width &&
      p.z >= site.z && p.z < site.z + length &&
      Math.abs(p.y - site.y) <= 4
    ) entityCount += 1
  }

  const perimeter = footprintPoints(site, { width, length })
  const supportChecks = perimeter.map(p => {
    const below = bot.blockAt(new Vec3(p.x, p.y - 1, p.z))
    return Boolean(below && !PASSABLE.has(below.name) && !LIQUIDS.has(below.name))
  })

  return {
    width,
    length,
    liquids,
    blockedClearance,
    unknown,
    nearbyEntities: entityCount,
    perimeterSupported: supportChecks.every(Boolean),
    levelVariance: heights.length ? Math.max(...heights) - Math.min(...heights) : null,
    safe: liquids === 0 && blockedClearance === 0 && unknown === 0 && supportChecks.every(Boolean) &&
      (heights.length === 0 || (Math.max(...heights) - Math.min(...heights)) <= 1),
    readOnly: true
  }
}

export function summarizeSitePreflight(result) {
  return [
    `site ${result.width}x${result.length}`,
    `liquids ${result.liquids}`,
    `clearance blocks ${result.blockedClearance}`,
    `unknown ${result.unknown}`,
    `entities ${result.nearbyEntities}`,
    `perimeter support ${result.perimeterSupported ? 'ok' : 'missing'}`,
    `safe ${result.safe ? 'yes' : 'no'}`
  ].join(' | ')
}
