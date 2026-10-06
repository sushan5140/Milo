function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function createImageReference({
  source,
  kind = null,
  mimeType = null,
  fileName = null,
  width = null,
  height = null,
  sha256 = null,
  metadata = {}
}) {
  if (!source || typeof source !== 'string') throw new Error('INVALID_IMAGE_SOURCE')

  const inferredKind = kind || (isHttpUrl(source) ? 'url' : 'file')
  if (!['url', 'file'].includes(inferredKind)) throw new Error('INVALID_IMAGE_KIND')

  return {
    kind: inferredKind,
    source,
    mimeType,
    fileName,
    width,
    height,
    sha256,
    metadata,
    createdAt: new Date().toISOString()
  }
}

export function validateImageReference(reference) {
  if (!reference?.source) throw new Error('INVALID_IMAGE_REFERENCE')
  if (!['url', 'file'].includes(reference.kind)) throw new Error('INVALID_IMAGE_KIND')

  if (reference.kind === 'url' && !isHttpUrl(reference.source)) {
    throw new Error('INVALID_IMAGE_URL')
  }

  return true
}

export async function analyzeReferenceImage(reference, analyzer) {
  validateImageReference(reference)
  if (!analyzer || typeof analyzer.analyze !== 'function') {
    throw new Error('VISION_ANALYZER_UNAVAILABLE')
  }

  const observations = await analyzer.analyze(reference)
  if (!observations || typeof observations !== 'object') {
    throw new Error('INVALID_VISION_RESULT')
  }

  return {
    ...observations,
    source: observations.source || reference.source,
    analyzedAt: new Date().toISOString()
  }
}

export function createVisionAnalyzer({ analyze, name = 'custom', version = 'unknown' }) {
  if (typeof analyze !== 'function') throw new Error('INVALID_VISION_ANALYZER')
  return { name, version, analyze }
}
