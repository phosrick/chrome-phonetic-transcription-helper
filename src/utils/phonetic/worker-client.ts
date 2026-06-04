let workerInstance: Worker | null = null
let requestCounter = 0
const activeRequests = new Map<
  string,
  { resolve: (value: string) => void; reject: (error: Error) => void }
>()

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null
  }
  if (!workerInstance) {
    // WXT / Vite handles bundling this URL format automatically
    workerInstance = new Worker(
      new URL("./phonetic.worker.ts", import.meta.url),
      { type: "module" }
    )
    workerInstance.addEventListener("message", (event: MessageEvent) => {
      const { id, success, result, error } = event.data
      const callback = activeRequests.get(id)
      if (callback) {
        activeRequests.delete(id)
        if (success) {
          callback.resolve(result)
        } else {
          callback.reject(new Error(error || "Worker transcription failed"))
        }
      }
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
    const { transcribeTextToPhonetics } = await import("./transcribe")
    return transcribeTextToPhonetics(text)
  }

  return new Promise<string>((resolve, reject) => {
    const id = `req_${++requestCounter}_${Date.now()}`
    activeRequests.set(id, { resolve, reject })
    worker.postMessage({ id, text })
  })
}
