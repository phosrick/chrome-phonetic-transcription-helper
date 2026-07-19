import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { browser, i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sendMessage } from "@/utils/message"
import { formatHotkey } from "@/utils/os.ts"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { cn } from "@/utils/styles/utils"
import { isPagePhoneticAtom, isPageTranslatedAtom, isPageTrilingualAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export default function TranslationControls() {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const [isPagePhonetic, setIsPagePhonetic] = useAtom(isPagePhoneticAtom)
  const [isPageTrilingual, setIsPageTrilingual] = useAtom(isPageTrilingualAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const isCurrentSiteInBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)

  const isSiteBlocked = mode === "whitelist" ? !isCurrentSiteInWhitelist : isCurrentSiteInBlacklist
  const isDisabled = isIgnoreTab || isSiteBlocked

  const toggleTranslation = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      const nextEnabled = !isPageTranslated
      // If we enable translation, make sure phonetic guide mode is disabled first
      if (nextEnabled && isPagePhonetic) {
        setIsPagePhonetic(false)
      }
      if (nextEnabled && isPageTrilingual) {
        setIsPageTrilingual(false)
      }

      void sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab.id,
        enabled: nextEnabled,
        mode: "translation",
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
          : undefined,
      })

      setIsPageTranslated(nextEnabled)
    }
  }

  const togglePhonetic = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      const nextEnabled = !isPagePhonetic
      // If we enable phonetic guide, make sure translation mode is disabled first
      if (nextEnabled && isPageTranslated) {
        setIsPageTranslated(false)
      }
      if (nextEnabled && isPageTrilingual) {
        setIsPageTrilingual(false)
      }

      void sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab.id,
        enabled: nextEnabled,
        mode: "phonetic",
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
          : undefined,
      })

      setIsPagePhonetic(nextEnabled)
    }
  }

  const toggleTrilingual = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      const nextEnabled = !isPageTrilingual
      if (nextEnabled && isPageTranslated) {
        setIsPageTranslated(false)
      }
      if (nextEnabled && isPagePhonetic) {
        setIsPagePhonetic(false)
      }

      void sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab.id,
        enabled: nextEnabled,
        mode: "trilingual",
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
          : undefined,
      })

      setIsPageTrilingual(nextEnabled)
    }
  }

  const formattedShortcut = formatHotkey(translateConfig.page.shortcut)
  const shortcutSuffix = isPageTranslationShortcutEmpty(translateConfig.page.shortcut) ? "" : ` (${formattedShortcut})`

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="grid grid-cols-2 gap-3 w-full">
        <Button
          onClick={toggleTranslation}
          disabled={isDisabled}
          variant={isPageTranslated ? "default" : "outline"}
          className={cn(
            "h-10 min-w-0 gap-1.5 px-2 font-semibold shadow-xs transition-all duration-200 border-border bg-background dark:border-input dark:bg-input/30",
            isPageTranslated
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-transparent"
              : "hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 dark:hover:border-blue-500",
          )}
        >
          <Icon icon="tabler:language" className="size-5 shrink-0" />
          <span className="min-w-0 truncate">
            {isPageTranslated
              ? i18n.t("popup.showOriginal")
              : `${i18n.t("popup.translate")}${shortcutSuffix}`}
          </span>
        </Button>

        <Button
          onClick={togglePhonetic}
          disabled={isDisabled}
          variant={isPagePhonetic ? "default" : "outline"}
          className={cn(
            "h-10 min-w-0 gap-1.5 px-2 font-semibold shadow-xs transition-all duration-200 border-border bg-background dark:border-input dark:bg-input/30",
            isPagePhonetic
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-transparent"
              : "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 dark:hover:border-emerald-500",
          )}
        >
          <Icon icon="tabler:abc" className="size-5 shrink-0" />
          <span className="min-w-0 truncate">
            {isPagePhonetic ? i18n.t("popup.hidePhonetics") : i18n.t("popup.phoneticGuide")}
          </span>
        </Button>
      </div>

      <div className="w-full">
        <Button
          onClick={toggleTrilingual}
          disabled={isDisabled}
          variant={isPageTrilingual ? "default" : "outline"}
          className={cn(
            "h-10 w-full min-w-0 gap-2 px-3 font-semibold shadow-xs transition-all duration-200 border-border bg-background dark:border-input dark:bg-input/30",
            isPageTrilingual
              ? "bg-gradient-to-r from-amber-700 to-rose-700 hover:from-amber-800 hover:to-rose-800 text-white border-transparent"
              : "hover:border-amber-600 hover:text-amber-700 dark:hover:text-amber-400 dark:hover:border-amber-500",
          )}
        >
          <Icon icon="tabler:book-2" className="size-5 shrink-0" />
          <span className="min-w-0 truncate">
            {isPageTrilingual ? i18n.t("popup.hideTrilingualMode") : i18n.t("popup.trilingualMode")}
          </span>
        </Button>
      </div>
    </div>
  )
}
