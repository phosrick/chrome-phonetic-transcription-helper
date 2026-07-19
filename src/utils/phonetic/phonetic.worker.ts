import { transcribeTextToPhonetics } from "./transcribe"

globalThis.addEventListener("message", (event: MessageEvent) => {
  const { id, text, pronunciationVariant } = event.data
  if (id && text !== undefined) {
    try {
      const result = transcribeTextToPhonetics(text, pronunciationVariant)
      globalThis.postMessage({ id, success: true, result })
    }
    catch (error: any) {
      globalThis.postMessage({ id, success: false, error: error.message || String(error) })
    }
  }
})
