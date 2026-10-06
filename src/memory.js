import fs from 'node:fs/promises'
import path from 'node:path'

export class MemoryStore {
  constructor(filePath) {
    this.filePath = filePath
    this._saveChain = Promise.resolve()
    this.data = {
      owner: {},
      places: {},
      storage: {},
      projects: {},
      tasks: { current: null, pending: null },
      recovery: { lastDeath: null },
      events: []
    }
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      this.data = { ...this.data, ...JSON.parse(raw) }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  get(key) {
    return key.split('.').reduce((value, part) => value?.[part], this.data)
  }

  set(key, value) {
    const parts = key.split('.')
    let target = this.data
    for (const part of parts.slice(0, -1)) {
      target[part] ??= {}
      target = target[part]
    }
    target[parts.at(-1)] = value
  }

  pushEvent(type, payload = {}) {
    this.data.events.push({
      type,
      payload,
      at: new Date().toISOString()
    })

    if (this.data.events.length > 500) {
      this.data.events = this.data.events.slice(-500)
    }
  }

  async save() {
    const snapshot = JSON.stringify(this.data, null, 2)
    const tempPath = `${this.filePath}.tmp`

    this._saveChain = this._saveChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true })
      await fs.writeFile(tempPath, snapshot)
      await fs.rename(tempPath, this.filePath)
    })

    return this._saveChain
  }
}
