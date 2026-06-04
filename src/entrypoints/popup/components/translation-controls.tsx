import { Icon } from "@iconify/react"
import { deepmerge } from "deepmerge-ts"
import { useAtom, useAtomValue } from "jotai"
import { browser, i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Switch } from "@/components/ui/base-ui/switch"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sendMessage } from "@/utils/message"
import { formatHotkey } from "@/utils/os.ts"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { cn } from "@/utils/styles/utils"
import { isPagePhoneticAtom, isPageTranslatedAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export default function TranslationControls() {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const [isPagePhonetic, setIsPagePhonetic] = useAtom(isPagePhoneticAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
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

  const handleTrilingualChange = (checked: boolean) => {
    void setTranslateConfig(
      deepmerge(translateConfig, {
        phonetic: {
          showAlongsideTranslation: checked,
        },
      }),
    )
  }

  const formattedShortcut = formatHotkey(translateConfig.page.shortcut)
  const shortcutSuffix = isPageTranslationShortcutEmpty(translateConfig.page.shortcut) ? "" : ` (${formattedShortcut})`

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Action Buttons */}
      <div className="flex gap-3 w-full">
        <Button
          onClick={toggleTranslation}
          disabled={isDisabled}
          variant={isPageTranslated ? "default" : "outline"}
          className={cn(
            "flex-1 h-10 gap-2 font-semibold shadow-xs transition-all duration-200 border-border bg-background dark:border-input dark:bg-input/30",
            isPageTranslated
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-transparent"
              : "hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 dark:hover:border-blue-500",
          )}
        >
          <Icon icon="tabler:language" className="size-5" />
          <span className="truncate">
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
            "flex-1 h-10 gap-2 font-semibold shadow-xs transition-all duration-200 border-border bg-background dark:border-input dark:bg-input/30",
            isPagePhonetic
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-transparent"
              : "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 dark:hover:border-emerald-500",
          )}
        >
          <Icon icon="tabler:abc" className="size-5" />
          <span className="truncate">
            {isPagePhonetic ? i18n.t("popup.hidePhonetics") : i18n.t("popup.phoneticGuide")}
          </span>
        </Button>
      </div>

      {/* Trilingual Option Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 dark:bg-muted/10 transition-colors duration-200 hover:bg-muted/60 dark:hover:bg-muted/20">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
            {i18n.t("popup.trilingualMode")}
            <Icon icon="tabler:help-circle" className="size-3.5 text-muted-foreground cursor-help" />
          </span>
          <span className="text-[11px] text-muted-foreground leading-normal">
            {i18n.t("popup.trilingualModeDescription")}
          </span>
        </div>
        <Switch
          checked={translateConfig.phonetic.showAlongsideTranslation}
          onCheckedChange={handleTrilingualChange}
          disabled={isDisabled}
        />
      </div>
    </div>
  )
}
