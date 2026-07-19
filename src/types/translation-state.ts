import { z } from "zod"

export const pageTranslationModeSchema = z.enum(["translation", "phonetic", "trilingual"])
export type PageTranslationMode = z.infer<typeof pageTranslationModeSchema>

export const translationStateSchema = z.object({
  enabled: z.boolean(),
  origin: z.string().optional(),
  mode: pageTranslationModeSchema.optional(),
})

export type TranslationState = z.infer<typeof translationStateSchema>
