let workerInstance: Worker | null = null
let requestCounter = 0
const WORKER_REQUEST_TIMEOUT_MS = 8000
const activeRequests = new Map<
  string,
  { resolve: (value: string) => void, reject: (error: Error) => void, timeoutId: ReturnType<typeof setTimeout> }
>()

async function transcribeInline(text: string): Promise<string> {
  const { transcribeTextToPhonetics } = await import("./transcribe")
  return transcribeTextToPhonetics(text)
}

function rejectActiveRequests(error: Error): void {
  for (const [id, callback] of activeRequests) {
    clearTimeout(callback.timeoutId)
    activeRequests.delete(id)
    callback.reject(error)
  }
}

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null
  }
  if (!workerInstance) {
    try {
      // WXT / Vite handles bundling this URL format automatically
      workerInstance = new Worker(
        new URL("./phonetic.worker.ts", import.meta.url),
        { type: "module" },
      )
    }
    catch {
      workerInstance = null
      return null
    }
    workerInstance.addEventListener("message", (event: MessageEvent) => {
      const { id, success, result, error } = event.data
      const callback = activeRequests.get(id)
      if (callback) {
        clearTimeout(callback.timeoutId)
        activeRequests.delete(id)
        if (success) {
          callback.resolve(result)
        }
        else {
          callback.reject(new Error(error || "Worker transcription failed"))
        }
      }
    })
    workerInstance.addEventListener("error", () => {
      rejectActiveRequests(new Error("Worker transcription failed"))
      workerInstance?.terminate()
      workerInstance = null
    })
  }
  return workerInstance
}

/**
 * Offloads phonetic transcription logic to a background Web Worker.
 * If the environment doesn't support Web Workers (e.g. Node.js unit tests),
 * it falls back to importing and running it inline.
 */
export async function transcribeTextToPhoneticsAsync(text: string): Promise<string> {
  const worker = getWorker()
  if (!worker) {
    // Fallback for environment without Web Worker support (e.g., node / vitest)
    return transcribeInline(text)
  }

  return new Promise<string>((resolve, reject) => {
    const id = `req_${++requestCounter}_${Date.now()}`
    const timeoutId = setTimeout(() => {
      activeRequests.delete(id)
      reject(new Error("Worker transcription timed out"))
    }, WORKER_REQUEST_TIMEOUT_MS)
    activeRequests.set(id, { resolve, reject, timeoutId })
    try {
      worker.postMessage({ id, text })
    }
    catch (error) {
      clearTimeout(timeoutId)
      activeRequests.delete(id)
      workerInstance?.terminate()
      workerInstance = null
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  }).catch(() => transcribeInline(text))
}
