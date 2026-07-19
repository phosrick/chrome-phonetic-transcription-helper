import { Icon } from "@iconify/react"
import { i18n } from "#imports"
import { UserAccount } from "@/components/user-account"
import { ENABLE_READFROG_CLOUD_FEATURES } from "@/utils/constants/feature-flags"
import { openOptionsPage } from "@/utils/navigation"
import { version } from "../../../package.json"
import { AISmartContext } from "./components/ai-smart-context"
import { AlwaysTranslate } from "./components/always-translate"
import BlogNotification from "./components/blog-notification"
import LanguageOptionsSelector from "./components/language-options-selector"
import Hotkey from "./components/node-translation-hotkey-selector"
import { SiteControlToggle } from "./components/site-control-toggle"
import TranslatePromptSelector from "./components/translate-prompt-selector"
import TranslateProviderField from "./components/translate-provider-field"
import TranslationControls from "./components/translation-controls"
import { TranslationHubButton } from "./components/translation-hub-button"
import TranslationModeSelector from "./components/translation-mode-selector"

function App() {
  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between">
          {ENABLE_READFROG_CLOUD_FEATURES && <UserAccount />}
          <div className="ml-auto flex items-center">
            <TranslationHubButton />
            <BlogNotification />
          </div>
        </div>
        <LanguageOptionsSelector />
        <TranslationModeSelector />
        <TranslateProviderField />
        <TranslatePromptSelector />
        <div className="w-full">
          <TranslationControls />
        </div>
        <SiteControlToggle />
        <AlwaysTranslate />
        <Hotkey />
        <AISmartContext />
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() => {
            void openOptionsPage()
          }}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">
            {i18n.t("popup.options")}
          </span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {version}
        </span>
      </div>
    </>
  )
}

export default App
