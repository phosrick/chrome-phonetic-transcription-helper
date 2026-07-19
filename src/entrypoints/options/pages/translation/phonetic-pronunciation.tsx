import type { PhoneticPronunciationVariant } from "@/types/config/translate"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { i18n } from "#imports"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { PHONETIC_PRONUNCIATION_VARIANTS } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function PhoneticPronunciation() {
  return (
    <ConfigCard
      id="phonetic-pronunciation"
      title={i18n.t("options.translation.phoneticPronunciation.title")}
      description={i18n.t("options.translation.phoneticPronunciation.description")}
    >
      <PhoneticPronunciationSelector />
    </ConfigCard>
  )
}

function PhoneticPronunciationSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const currentVariant = translateConfig.phonetic.pronunciationVariant

  const handleVariantChange = (variant: PhoneticPronunciationVariant | null) => {
    if (!variant)
      return

    void setTranslateConfig(
      deepmerge(translateConfig, {
        phonetic: {
          pronunciationVariant: variant,
        },
      }),
    )
  }

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t("options.translation.phoneticPronunciation.label")}
      </FieldLabel>
      <Select
        value={currentVariant}
        onValueChange={handleVariantChange}
      >
        <SelectTrigger className="w-full md:w-56">
          <SelectValue>
            {i18n.t(`options.translation.phoneticPronunciation.variant.${currentVariant}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PHONETIC_PRONUNCIATION_VARIANTS.map(variant => (
              <SelectItem key={variant} value={variant}>
                {i18n.t(`options.translation.phoneticPronunciation.variant.${variant}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
