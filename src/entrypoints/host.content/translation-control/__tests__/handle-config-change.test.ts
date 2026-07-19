import type { PageTranslationManager } from "../page-translation"
import type { Config } from "@/types/config/config"
import type { PageTranslationMode } from "@/types/translation-state"
import { describe, expect, it, vi } from "vitest"
import { handleTranslationModeChange } from "../handle-config-change"

function createMockConfig(mode: "bilingual" | "translationOnly", showAlongsideTranslation = false): Config {
  return {
    translate: {
      mode,
      phonetic: {
        showAlongsideTranslation,
      },
    },
  } as Config
}

function createMockManager(isActive: boolean, mode: PageTranslationMode = "translation"): PageTranslationManager {
  return {
    isActive,
    mode,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  } as unknown as PageTranslationManager
}

describe("handleTranslationModeChange", () => {
  it("should trigger re-translation when mode changes and manager is active", () => {
    const manager = createMockManager(true, "translation")

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalledWith(undefined, "translation")
  })

  it("should trigger re-translation when trilingual mode changes and manager is active", () => {
    const manager = createMockManager(true, "phonetic")

    handleTranslationModeChange(
      createMockConfig("bilingual", true),
      createMockConfig("bilingual", false),
      manager,
    )

    expect(manager.stop).toHaveBeenCalled()
    expect(manager.start).toHaveBeenCalledWith(undefined, "phonetic")
  })

  it("should not trigger when mode stays the same", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).not.toHaveBeenCalled()
  })

  it("should not trigger when manager is not active", () => {
    const manager = createMockManager(false)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.stop).not.toHaveBeenCalled()
  })
})
