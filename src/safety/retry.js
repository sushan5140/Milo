const RETRYABLE = new Set([
  'FURNACE_BUSY',
  'SMELT_TIMEOUT',
  'STORAGE_MISSING',
  'NoPath',
  'PathStopped'
])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function errorCode(error) {
  const message = String(error?.message || error)
  for (const code of RETRYABLE) {
    if (message === code || message.includes(code)) return code
  }
  return null
}

export async function withRetries(fn, {
  attempts = 3,
  delayMs = 1500,
  onRetry = () => {}
} = {}) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      const code = errorCode(error)
      if (!code || attempt >= attempts) throw error
      onRetry({ attempt, code, error })
      await sleep(delayMs * attempt)
    }
  }

  throw lastError
}
