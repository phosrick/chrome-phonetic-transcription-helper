import { z } from "zod"

export const translationStateSchema = z.object({
  enabled: z.boolean(),
  origin: z.string().optional(),
  mode: z.enum(["translation", "phonetic"]).optional(),
})

export type TranslationState = z.infer<typeof translationStateSchema>
