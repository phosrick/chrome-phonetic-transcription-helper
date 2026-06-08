import { transcribeTextToPhonetics } from "./transcribe"

globalThis.addEventListener("message", (event: MessageEvent) => {
  const { id, text } = event.data
  if (id && text !== undefined) {
    try {
      const result = transcribeTextToPhonetics(text)
      globalThis.postMessage({ id, success: true, result })
    }
    catch (error: any) {
      globalThis.postMessage({ id, success: false, error: error.message || String(error) })
    }
  }
})
