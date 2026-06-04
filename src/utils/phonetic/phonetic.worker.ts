import { transcribeTextToPhonetics } from "./transcribe"

self.addEventListener("message", (event: MessageEvent) => {
  const { id, text } = event.data
  if (id && text !== undefined) {
    try {
      const result = transcribeTextToPhonetics(text)
      self.postMessage({ id, success: true, result })
    } catch (error: any) {
      self.postMessage({ id, success: false, error: error.message || String(error) })
    }
  }
})
