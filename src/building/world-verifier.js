import vec3 from 'vec3'
import { flattenExpectedBlocks } from './geometry.js'

const { Vec3 } = vec3

export function verifyPlanAgainstWorld(bot, plan, site, { sampleLimit = 512 } = {}) {
  const expected = flattenExpectedBlocks(plan, site)
  const sample = expected.slice(0, Math.max(1, sampleLimit))

  const mismatches = []
  let matches = 0

  for (const item of sample) {
    const block = bot.blockAt(new Vec3(item.x, item.y, item.z))
    const actual = block?.name || 'unknown'
    if (actual === item.expected) {
      matches += 1
    } else {
      mismatches.push({
        x: item.x,
        y: item.y,
        z: item.z,
        expected: item.expected,
        actual,
        role: item.role
      })
    }
  }

  return {
    checked: sample.length,
    matches,
    mismatches,
    matchRate: sample.length ? matches / sample.length : 0,
    complete: sample.length > 0 && mismatches.length === 0,
    readOnly: true
  }
}

export function summarizeWorldVerification(result) {
  if (!result.checked) return 'nothing was checked.'
  const pct = Math.round(result.matchRate * 100)
  return `checked ${result.checked} planned blocks: ${pct}% match, ${result.mismatches.length} mismatches.`
}
