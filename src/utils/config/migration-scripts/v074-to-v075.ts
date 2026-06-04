/**
 * Migration script from v074 to v075
 * - Adds phonetic config object to translate config.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      phonetic: {
        showAlongsideTranslation: oldConfig?.translate?.phonetic?.showAlongsideTranslation ?? false,
      },
    },
  }
}
