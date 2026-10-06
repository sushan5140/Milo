import { createVisionAnalyzer } from './image-ingest.js'

export function createHttpVisionAnalyzer({ endpoint, apiKey = null, model = null }) {
  if (!endpoint) throw new Error('VISION_ENDPOINT_MISSING')

  return createVisionAnalyzer({
    name: 'http-vision',
    version: model || 'custom',
    analyze: async reference => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          reference,
          task: {
            type: 'minecraft-build-reference',
            output: {
              style: 'string',
              width: 'number',
              length: 'number',
              height: 'number',
              roof: 'string',
              windows: 'number|string',
              entrances: 'number',
              palette: [{ block: 'minecraft_block_name', role: 'string', ratio: 'number' }],
              confidence: 'number',
              notes: ['string']
            }
          }
        })
      })

      if (!response.ok) throw new Error(`VISION_HTTP_${response.status}`)
      const data = await response.json()
      const observations = data.observations || data.result || data
      if (!observations || typeof observations !== 'object') throw new Error('INVALID_VISION_RESULT')
      return observations
    }
  })
}
