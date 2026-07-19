import { afterEach, describe, expect, it, vi } from "vitest"
import { transcribeTextToPhoneticsAsync } from "../worker-client"

describe("transcribeTextToPhoneticsAsync", () => {
  const originalWorker = globalThis.Worker

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalWorker === undefined) {
      // @ts-expect-error Restoring the absent worker state for Node test environments.
      delete globalThis.Worker
    }
    else {
      globalThis.Worker = originalWorker
    }
  })

  it("asynchronously transcribes text using the client fallback or worker", async () => {
    const input = "chrome phonetic helper"
    const expected = "<ruby>chrome<rt>/ˈkroʊm/</rt></ruby> <ruby>phonetic<rt>/fəˈnɛtɪk/</rt></ruby> <ruby>helper<rt>/ˈhɛlpɝ/</rt></ruby>"
    const result = await transcribeTextToPhoneticsAsync(input)
    expect(result).toBe(expected)
  })

  it("passes pronunciation variant options through async transcription", async () => {
    const result = await transcribeTextToPhoneticsAsync("and data", "all")

    expect(result).toBe("<ruby>and<rt>/ənd, ˈænd/</rt></ruby> <ruby>data<rt>/ˈdeɪtə, ˈdætə/</rt></ruby>")
  })

  it("falls back to inline transcription when worker construction fails", async () => {
    vi.stubGlobal("Worker", class {
      constructor() {
        throw new Error("worker load failed")
      }
    })

    const result = await transcribeTextToPhoneticsAsync("chrome helper")

    expect(result).toBe("<ruby>chrome<rt>/ˈkroʊm/</rt></ruby> <ruby>helper<rt>/ˈhɛlpɝ/</rt></ruby>")
  })
})
