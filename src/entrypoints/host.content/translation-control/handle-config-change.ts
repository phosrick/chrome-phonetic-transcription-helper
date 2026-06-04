import type { PageTranslationManager } from "./page-translation"
import type { Config } from "@/types/config/config"

/**
 * Handles config changes and re-translates page when translation mode changes
 * while page translation is active.
 */
export function handleTranslationModeChange(
  newConfig: Config | null,
  oldConfig: Config | null,
  manager: PageTranslationManager,
): void {
  if (!newConfig || !oldConfig)
    return

  const modeChanged = newConfig.translate.mode !== oldConfig.translate.mode
  const trilingualChanged = newConfig.translate.phonetic.showAlongsideTranslation !== oldConfig.translate.phonetic.showAlongsideTranslation

  if ((modeChanged || trilingualChanged) && manager.isActive) {
    const currentMode = manager.mode
    manager.stop()
    void manager.start(undefined, currentMode)
  }
}
