import type { PhoneticPronunciationVariant } from "@/types/config/translate"
import nlp from "compromise"
import CMU_DICT_RAW from "./cmu_dictionary.json"

const CMU_DICT = CMU_DICT_RAW as Record<string, string>

const DEFAULT_PRONUNCIATION_VARIANT: PhoneticPronunciationVariant = "spoken"

const SPOKEN_FUNCTION_WORD_IPA: Record<string, string> = {
  a: "ə",
  and: "ənd",
  of: "əv",
  the: "ðə",
  to: "tə",
}

// Common English homographs mapped to their POS-specific pronunciations
const HOMOGRAPH_MAP: Record<string, Record<string, string>> = {
  read: {
    PastTense: "rɛd",
    Participle: "rɛd",
    default: "riːd",
  },
  live: {
    Adjective: "laɪv",
    default: "lɪv",
  },
  lead: {
    Noun: "lɛd",
    default: "liːd",
  },
  wind: {
    Verb: "waɪnd",
    default: "wɪnd",
  },
  tear: {
    Verb: "tɛr",
    Noun: "tɪr",
    default: "tɛr",
  },
  close: {
    Adjective: "kloʊs",
    Adverb: "kloʊs",
    default: "kloʊz",
  },
}

function getPluralPhonetic(rootIpa: string): string {
  const cleanIpa = rootIpa.trim()
  if (!cleanIpa)
    return "z"

  // Sibilants check (ends with s, z, ʃ, ʒ, tʃ, dʒ)
  if (/(?:[szʃʒ]|tʃ|dʒ)$/.test(cleanIpa)) {
    return `${cleanIpa}ɪz`
  }
  // Voiceless consonants check (ends with p, t, k, f, θ)
  if (/[ptkfθ]$/.test(cleanIpa)) {
    return `${cleanIpa}s`
  }
  // Voiced consonants and vowels
  return `${cleanIpa}z`
}

function getPastTensePhonetic(rootIpa: string): string {
  const cleanIpa = rootIpa.trim()
  if (!cleanIpa)
    return "d"

  // Ends in t or d -> append ɪd
  if (/[td]$/.test(cleanIpa)) {
    return `${cleanIpa}ɪd`
  }
  // Ends in voiceless consonant -> append t
  if (/(?:[pkfsʃθ]|tʃ)$/.test(cleanIpa)) {
    return `${cleanIpa}t`
  }
  // Ends in voiced sound -> append d
  return `${cleanIpa}d`
}

function lookupPhoneticWithFallback(word: string): string | null {
  // 1. Direct lookup
  if (CMU_DICT[word]) {
    return CMU_DICT[word]
  }

  // 2. Adverb suffix -ly (length > 4)
  if (word.endsWith("ly") && word.length > 4) {
    const root1 = word.slice(0, -2) // quickly -> quick
    if (CMU_DICT[root1]) {
      return `${CMU_DICT[root1]}li`
    }
    if (root1.endsWith("i")) {
      const root2 = `${root1.slice(0, -1)}y` // happily -> happi -> happy
      if (CMU_DICT[root2]) {
        // Strip trailing vowel IPA if necessary, but simple append works well
        return `${CMU_DICT[root2]}li`
      }
    }
  }

  // 3. Present participle suffix -ing (length > 4)
  if (word.endsWith("ing") && word.length > 4) {
    const root1 = word.slice(0, -3) // learning -> learn
    if (CMU_DICT[root1]) {
      return `${CMU_DICT[root1]}ɪŋ`
    }
    const root2 = `${root1}e` // taking -> take
    if (CMU_DICT[root2]) {
      return `${CMU_DICT[root2]}ɪŋ`
    }
  }

  // 4. Past tense suffix -ed (length > 3)
  if (word.endsWith("ed") && word.length > 3) {
    const root1 = word.slice(0, -2) // walked -> walk
    if (CMU_DICT[root1]) {
      return getPastTensePhonetic(CMU_DICT[root1])
    }
    const root2 = word.slice(0, -1) // hated -> hate
    if (CMU_DICT[root2]) {
      return getPastTensePhonetic(CMU_DICT[root2])
    }
  }

  // 5. Plural / Third-person singular suffix -s (length > 2)
  if (word.endsWith("s") && word.length > 2) {
    // If ends in -es
    if (word.endsWith("es") && word.length > 3) {
      const rootEs1 = word.slice(0, -2) // boxes -> box
      if (CMU_DICT[rootEs1]) {
        return getPluralPhonetic(CMU_DICT[rootEs1])
      }
      if (rootEs1.endsWith("i")) {
        const rootEs2 = `${rootEs1.slice(0, -1)}y` // flies -> fli -> fly
        if (CMU_DICT[rootEs2]) {
          return getPluralPhonetic(CMU_DICT[rootEs2])
        }
      }
    }

    const rootS = word.slice(0, -1) // cats -> cat
    if (CMU_DICT[rootS]) {
      return getPluralPhonetic(CMU_DICT[rootS])
    }
  }

  return null
}

function getPrimaryPhonetic(ipa: string): string {
  return ipa.split(",").map(item => item.trim()).find(Boolean) ?? ipa.trim()
}

function getDisplayPhonetic(word: string, ipa: string, variant: PhoneticPronunciationVariant): string {
  if (variant === "all") {
    return ipa
  }

  if (variant === "spoken") {
    const spokenIpa = SPOKEN_FUNCTION_WORD_IPA[word]
    if (spokenIpa) {
      return spokenIpa
    }
  }

  return getPrimaryPhonetic(ipa)
}

export function transcribeTextToPhonetics(
  text: string,
  pronunciationVariant: PhoneticPronunciationVariant = DEFAULT_PRONUNCIATION_VARIANT,
): string {
  // Use compromise to perform POS tagging
  const doc = nlp(text)
  const sentences = doc.json({ terms: { text: true, tags: true, normal: true } }) as any[]

  // Flatten terms from compromise to match against segments
  const compromiseWords: { text: string, normal: string, tags: string[] }[] = []
  for (const sentence of sentences) {
    if (sentence.terms) {
      for (const term of sentence.terms) {
        compromiseWords.push({
          text: term.text || "",
          normal: term.normal || (term.text || "").toLowerCase(),
          tags: term.tags || [],
        })
      }
    }
  }

  // Use Intl.Segmenter to safely split text into words and punctuation
  const segmenter = new Intl.Segmenter("en", { granularity: "word" })
  const segments = [...segmenter.segment(text)]
  let result = ""
  let compIndex = 0

  for (const { segment, isWordLike } of segments) {
    if (!isWordLike) {
      result += escapeHtml(segment)
      continue
    }

    const lowerWord = segment.toLowerCase()
    let tags: string[] = []

    // Match segment to compromise word to get its tags
    if (compIndex < compromiseWords.length) {
      let found = false
      // Lookahead window of 3 to handle contraction discrepancies
      for (let i = compIndex; i < Math.min(compIndex + 3, compromiseWords.length); i++) {
        if (compromiseWords[i].normal === lowerWord || compromiseWords[i].text.toLowerCase() === lowerWord) {
          tags = compromiseWords[i].tags
          compIndex = i + 1
          found = true
          break
        }
      }
      if (!found) {
        // Fallback: take current compromise word tags and advance
        tags = compromiseWords[compIndex].tags
        compIndex++
      }
    }

    let ipa: string | null = null

    // Check for homograph resolution
    const homograph = HOMOGRAPH_MAP[lowerWord]
    if (homograph) {
      const matchingTag = tags.find(tag => tag in homograph)
      ipa = matchingTag ? homograph[matchingTag] : homograph.default
    }
    else {
      ipa = lookupPhoneticWithFallback(lowerWord)
    }

    if (ipa) {
      const escapedWord = escapeHtml(segment)
      const displayIpa = getDisplayPhonetic(lowerWord, ipa, pronunciationVariant)
      result += `<ruby>${escapedWord}<rt>/${displayIpa}/</rt></ruby>`
    }
    else {
      result += escapeHtml(segment)
    }
  }

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
