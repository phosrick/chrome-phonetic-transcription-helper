import { describe, expect, it } from "vitest"
import { transcribeTextToPhonetics } from "../transcribe"

describe("transcribeTextToPhonetics", () => {
  it("transcribes words present in the dictionary", () => {
    const input = "chrome phonetic helper"
    const expected = "<ruby>chrome<rt>/ˈkroʊm/</rt></ruby> <ruby>phonetic<rt>/fəˈnɛtɪk/</rt></ruby> <ruby>helper<rt>/ˈhɛlpɝ/</rt></ruby>"
    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })

  it("handles case-insensitive matching", () => {
    const input = "Chrome PHONETIC"
    const expected = "<ruby>Chrome<rt>/ˈkroʊm/</rt></ruby> <ruby>PHONETIC<rt>/fəˈnɛtɪk/</rt></ruby>"
    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })

  it("leaves punctuation and spaces as is", () => {
    const input = "chrome, phonetic."
    const expected = "<ruby>chrome<rt>/ˈkroʊm/</rt></ruby>, <ruby>phonetic<rt>/fəˈnɛtɪk/</rt></ruby>."
    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })

  it("applies suffix stripping fallbacks", () => {
    // helpers -> helper + s (r is voiced, so ending is z)
    expect(transcribeTextToPhonetics("helpers")).toBe("<ruby>helpers<rt>/ˈhɛlpɝz/</rt></ruby>")
    // learning -> learn + ing
    expect(transcribeTextToPhonetics("learning")).toBe("<ruby>learning<rt>/ˈlɝːnɪŋ/</rt></ruby>")
  })

  it("uses spoken-practice pronunciations by default for common function words", () => {
    const input = "and of to the a"
    const expected = "<ruby>and<rt>/ənd/</rt></ruby> <ruby>of<rt>/əv/</rt></ruby> <ruby>to<rt>/tə/</rt></ruby> <ruby>the<rt>/ðə/</rt></ruby> <ruby>a<rt>/ə/</rt></ruby>"

    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })

  it("uses the first dictionary pronunciation for primary mode", () => {
    expect(transcribeTextToPhonetics("and data", "primary")).toBe("<ruby>and<rt>/ənd/</rt></ruby> <ruby>data<rt>/ˈdeɪtə/</rt></ruby>")
  })

  it("keeps all dictionary pronunciations in all mode", () => {
    expect(transcribeTextToPhonetics("and data", "all")).toBe("<ruby>and<rt>/ənd, ˈænd/</rt></ruby> <ruby>data<rt>/ˈdeɪtə, ˈdætə/</rt></ruby>")
  })

  it("keeps homograph resolution ahead of dictionary pronunciation variants", () => {
    expect(transcribeTextToPhonetics("read", "all")).toBe("<ruby>read<rt>/riːd/</rt></ruby>")
  })

  it("leaves unknown words untranscribed", () => {
    const input = "unknownxyz word"
    const expected = "unknownxyz <ruby>word<rt>/ˈwɝːd/</rt></ruby>"
    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })

  it("escapes HTML entities in text to prevent XSS", () => {
    const input = "<script>alert(1)</script>"
    const expected = "&lt;<ruby>script<rt>/ˈskrɪpt/</rt></ruby>&gt;<ruby>alert<rt>/əˈlɝːt/</rt></ruby>(1)&lt;/<ruby>script<rt>/ˈskrɪpt/</rt></ruby>&gt;"
    expect(transcribeTextToPhonetics(input)).toBe(expected)
  })
})
