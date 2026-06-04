import { describe, expect, it } from "vitest"
import { transcribeTextToPhoneticsAsync } from "../worker-client"

describe("transcribeTextToPhoneticsAsync", () => {
  it("asynchronously transcribes text using the client fallback or worker", async () => {
    const input = "chrome phonetic helper"
    const expected = "<ruby>chrome<rt>/ˈkroʊm/</rt></ruby> <ruby>phonetic<rt>/fəˈnɛtɪk/</rt></ruby> <ruby>helper<rt>/ˈhɛlpɝ/</rt></ruby>"
    const result = await transcribeTextToPhoneticsAsync(input)
    expect(result).toBe(expected)
  })
})
