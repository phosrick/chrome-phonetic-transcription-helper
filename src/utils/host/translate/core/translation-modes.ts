import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { transcribeTextToPhoneticsAsync } from "../../../phonetic/worker-client"
import { batchDOMOperation } from "../../dom/batch-dom"
import { isBlockTransNode, isHTMLElement, isTextNode, isTransNode } from "../../dom/filter"
import { unwrapDeepestOnlyHTMLChild } from "../../dom/find"
import { getOwnerDocument } from "../../dom/node"
import { extractTextContent } from "../../dom/traversal"
import { removeTranslatedWrapperWithRestore } from "../dom/translation-cleanup"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"
import { prepareTranslationText } from "../text-preparation"
import { setTranslationDirAndLang } from "../translation-attributes"
import { decorateTranslationNode } from "../ui/decorate-translation"
import { createSpinnerInside, getTranslatedTextAndRemoveSpinner } from "../ui/spinner"
import { isNumericContent } from "../ui/translation-utils"
import { MARK_ATTRIBUTES_REGEX, originalContentMap, translatingNodes } from "./translation-state"

const PHONETIC_ANNOTATED_CLASS = "rf-phonetic-annotated"
const PHONETIC_TAG_NAMES = new Set(["RUBY", "RT", "RP"])

function isTransNodeAndNotTranslatedWrapper(node: Node): node is TransNode {
  if (isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS))
    return false
  return isTransNode(node)
}

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

function getDisplayTranslation(sourceText: string, translatedText: string | undefined) {
  if (translatedText === undefined) {
    return undefined
  }

  return prepareTranslationText(sourceText) === prepareTranslationText(translatedText)
    ? ""
    : translatedText
}

export async function translateNodes(
  nodes: ChildNode[],
  walkId: string,
  toggle: boolean = false,
  config: Config,
  forceBlockTranslation: boolean = false,
  mode?: "translation" | "phonetic",
): Promise<void> {
  const currentMode = mode ?? "translation"
  const showAlongside = config.translate.phonetic.showAlongsideTranslation

  if (currentMode === "phonetic" && !showAlongside) {
    await translateNodesPhoneticOnlyMode(nodes, walkId, config, toggle)
  }
  else if (showAlongside) {
    await translateNodesTrilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
  }
  else {
    const translationMode = config.translate.mode
    if (translationMode === "translationOnly") {
      await translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
    }
    else if (translationMode === "bilingual") {
      await translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
    }
  }
}

export async function translateNodesBilingualMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
): Promise<void> {
  const transNodes = nodes.filter(node => isTransNode(node))
  if (transNodes.length === 0) {
    return
  }
  try {
    // prevent duplicate translation
    if (transNodes.every(node => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach(node => translatingNodes.add(node))

    const lastNode = transNodes.at(-1)!
    const targetNode
      = transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode)
        ? await unwrapDeepestOnlyHTMLChild(lastNode)
        : lastNode

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodesBilingualMode(nodes, walkId, config, toggle)
        return
      }
    }

    const textContent = transNodes.map(node => extractTextContent(node, config)).join("").trim()
    if (!textContent || isNumericContent(textContent))
      return

    if (await shouldFilterSmallParagraph(textContent, config))
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion to reduce layout thrashing
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)

    const translatedText = getDisplayTranslation(textContent, realTranslatedText)

    if (!translatedText) {
      // Only remove wrapper if translation returned empty (not needed),
      // but keep it for error display (undefined)
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    await insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
      config.translate.translationNodeStyle,
      forceBlockTranslation,
    )
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
): Promise<void> {
  const outerTransNodes = nodes.filter(isTransNode)
  if (outerTransNodes.length === 0) {
    return
  }

  // snapshot the outer parent element, to prevent lose it if we go to deeper by unwrapDeepestOnlyHTMLChild
  // test case is:
  // <div data-testid="test-node">
  //   <span style={{ display: 'inline' }}>原文</span> // get the outer parent snapshot before go to inner element
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  //   原文
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  // </div>,
  // Only save originalContent when there's no existing translation wrapper
  // If wrapper exists, we're removing translation and should restore from saved content
  const outerParentElement = outerTransNodes[0].parentElement
  const hasExistingWrapper = outerParentElement?.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
  if (outerParentElement && !originalContentMap.has(outerParentElement) && !hasExistingWrapper) {
    originalContentMap.set(outerParentElement, outerParentElement.innerHTML)
  }

  let transNodes: TransNode[] = []
  let allChildNodes: ChildNode[] = []
  if (outerTransNodes.length === 1 && isHTMLElement(outerTransNodes[0])) {
    const unwrappedHTMLChild = await unwrapDeepestOnlyHTMLChild(outerTransNodes[0])
    allChildNodes = [...unwrappedHTMLChild.childNodes]
    transNodes = allChildNodes.filter(isTransNodeAndNotTranslatedWrapper)
  }
  else {
    transNodes = outerTransNodes
    allChildNodes = nodes
  }

  if (transNodes.length === 0) {
    return
  }

  try {
    if (nodes.every(node => translatingNodes.has(node))) {
      return
    }
    nodes.forEach(node => translatingNodes.add(node))

    const targetNode = transNodes.at(-1)!

    const parentNode = targetNode.parentElement
    if (!parentNode) {
      console.error("targetNode.parentElement is not HTMLElement", targetNode.parentElement)
      return
    }
    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode.parentElement, walkId)
    const existedTranslatedWrapperOutside = targetNode.parentElement.closest(`.${CONTENT_WRAPPER_CLASS}`)

    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper
    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        // In translationOnly mode, removeTranslatedWrapperWithRestore uses innerHTML to restore content,
        // which destroys the original DOM nodes and creates new ones. The 'nodes' array still references
        // the old detached nodes, and targetNode can't reference to the new dom added by innerHTML anymore.
        // Therefore, by recursively calling translateNodeTranslationOnlyMode here with the
        // same nodes array, we ensure the translation uses the newly created DOM elements since the
        // function will re-query and find the correct parent and child nodes from the restored DOM.
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
        return
      }
    }

    const innerTextContent = transNodes.map(node => extractTextContent(node, config)).join("")
    if (!innerTextContent.trim() || isNumericContent(innerTextContent))
      return

    if (await shouldFilterSmallParagraph(innerTextContent, config))
      return

    const cleanTextContent = (content: string): string => {
      if (!content)
        return content

      let cleanedContent = content.replace(MARK_ATTRIBUTES_REGEX, "")
      cleanedContent = cleanedContent.replace(HTML_COMMENT_RE, " ")

      return cleanedContent
    }

    // Only save originalContent when there's no existing translation wrapper
    const hasExistingWrapperInParent = parentNode.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    if (!originalContentMap.has(parentNode) && !hasExistingWrapperInParent) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    const getStringFormatFromNode = (node: Element | Text) => {
      if (isTextNode(node)) {
        return node.textContent
      }
      return node.outerHTML
    }

    const textContent = cleanTextContent(transNodes.map(getStringFormatFromNode).join(""))
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    translatedWrapperNode.style.display = "contents"
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion to reduce layout thrashing
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)
    const translatedText = realTranslatedText ? getDisplayTranslation(textContent, realTranslatedText) : realTranslatedText

    if (!translatedText) {
      // Keep the wrapper when translation failed so the injected error UI remains visible.
      // Only remove the wrapper when translation returned an empty string.
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    translatedWrapperNode.innerHTML = translatedText

    // Batch final DOM mutations to reduce layout thrashing
    batchDOMOperation(() => {
      // Insert translated content after the last node
      const lastChildNode = allChildNodes.at(-1)!
      lastChildNode.parentNode?.insertBefore(translatedWrapperNode, lastChildNode.nextSibling)

      // Remove all original nodes
      allChildNodes.forEach(childNode => childNode.remove())
    })
  }
  finally {
    nodes.forEach(node => translatingNodes.delete(node))
  }
}

function collectTextNodes(node: Node): Text[] {
  if (isTextNode(node)) {
    const text = node.textContent ?? ""
    if (text.trim()) {
      return [node]
    }
    return []
  }
  if (isHTMLElement(node)) {
    if (
      node.classList.contains(CONTENT_WRAPPER_CLASS)
      || node.classList.contains(NOTRANSLATE_CLASS)
      || node.classList.contains(PHONETIC_ANNOTATED_CLASS)
      || PHONETIC_TAG_NAMES.has(node.tagName)
    ) {
      return []
    }
    const results: Text[] = []
    const children = Array.from(node.childNodes)
    for (const child of children) {
      results.push(...collectTextNodes(child))
    }
    return results
  }
  return []
}

export async function translateNodesPhoneticOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
): Promise<void> {
  const transNodes = nodes.filter(isTransNode)
  if (transNodes.length === 0) {
    return
  }

  try {
    if (transNodes.every(node => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach(node => translatingNodes.add(node))

    const targetNode = transNodes.at(-1)!
    const parentNode = targetNode.parentElement
    if (!parentNode) {
      return
    }

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(parentNode, walkId)
    const existedTranslatedWrapperOutside = parentNode.closest(`.${CONTENT_WRAPPER_CLASS}`)
    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper

    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        transNodes.forEach(node => translatingNodes.delete(node))
        void translateNodesPhoneticOnlyMode(nodes, walkId, config, toggle)
        return
      }
    }

    // Save original content
    const hasExistingWrapperInParent = parentNode.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    if (!originalContentMap.has(parentNode) && !hasExistingWrapperInParent) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    const ownerDoc = getOwnerDocument(targetNode)

    // Collect all text nodes
    const textNodes: Text[] = []
    for (const node of transNodes) {
      textNodes.push(...collectTextNodes(node))
    }

    // Request transcriptions asynchronously
    const transcriptions = await Promise.all(
      textNodes.map(node => transcribeTextToPhoneticsAsync(node.textContent ?? "")),
    )

    // Batch DOM mutations
    batchDOMOperation(() => {
      textNodes.forEach((node, index) => {
        const ipaHtml = transcriptions[index]
        const span = ownerDoc.createElement("span")
        span.className = `${NOTRANSLATE_CLASS} ${PHONETIC_ANNOTATED_CLASS}`
        span.innerHTML = ipaHtml
        node.parentNode?.replaceChild(span, node)
      })
    })

    // Insert a hidden wrapper node as a marker for cleanup
    const markerWrapper = ownerDoc.createElement("span")
    markerWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    markerWrapper.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly" satisfies TranslationMode)
    markerWrapper.setAttribute(WALKED_ATTRIBUTE, walkId)
    markerWrapper.style.display = "none"

    batchDOMOperation(() => {
      targetNode.parentNode?.insertBefore(markerWrapper, targetNode.nextSibling)
    })
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodesTrilingualMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
): Promise<void> {
  const transNodes = nodes.filter(isTransNode)
  if (transNodes.length === 0) {
    return
  }

  try {
    if (transNodes.every(node => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach(node => translatingNodes.add(node))

    const targetNode = transNodes.at(-1)!
    const parentNode = targetNode.parentElement
    if (!parentNode) {
      return
    }

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(parentNode, walkId)
    const existedTranslatedWrapperOutside = parentNode.closest(`.${CONTENT_WRAPPER_CLASS}`)
    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper

    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        transNodes.forEach(node => translatingNodes.delete(node))
        void translateNodesTrilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
        return
      }
    }

    const cleanTextContent = (content: string): string => {
      if (!content)
        return content

      let cleanedContent = content.replace(MARK_ATTRIBUTES_REGEX, "")
      cleanedContent = cleanedContent.replace(HTML_COMMENT_RE, " ")

      return cleanedContent
    }

    const getStringFormatFromNode = (node: Element | Text) => {
      if (isTextNode(node)) {
        return node.textContent
      }
      return node.outerHTML
    }

    const textContent = cleanTextContent(transNodes.map(getStringFormatFromNode).join(""))
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion of the wrapper/spinner
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)
    const translatedText = realTranslatedText ? getDisplayTranslation(textContent, realTranslatedText) : realTranslatedText

    if (!translatedText) {
      if (translatedText === "") {
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    // Save original content BEFORE annotating the original nodes
    const hasExistingWrapperInParent = parentNode.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    if (!originalContentMap.has(parentNode) && !hasExistingWrapperInParent) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    // Collect all text nodes
    const textNodes: Text[] = []
    for (const node of transNodes) {
      textNodes.push(...collectTextNodes(node))
    }

    // Request transcriptions asynchronously
    const transcriptions = await Promise.all(
      textNodes.map(node => transcribeTextToPhoneticsAsync(node.textContent ?? "")),
    )

    // Batch DOM mutations
    batchDOMOperation(() => {
      textNodes.forEach((node, index) => {
        const ipaHtml = transcriptions[index]
        const span = ownerDoc.createElement("span")
        span.className = `${NOTRANSLATE_CLASS} ${PHONETIC_ANNOTATED_CLASS}`
        span.innerHTML = ipaHtml
        node.parentNode?.replaceChild(span, node)
      })
    })

    // Now populate the translatedWrapperNode with translation text
    const translationSpan = ownerDoc.createElement("span")
    translationSpan.textContent = translatedText

    await decorateTranslationNode(translationSpan, config.translate.translationNodeStyle)

    const isBlock = isBlockTransNode(targetNode) || forceBlockTranslation

    batchDOMOperation(() => {
      translatedWrapperNode.innerHTML = ""
      if (isBlock) {
        const brNode = ownerDoc.createElement("br")
        translatedWrapperNode.appendChild(brNode)
        translationSpan.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
      }
      else {
        const spaceNode = ownerDoc.createElement("span")
        spaceNode.textContent = "  "
        translatedWrapperNode.appendChild(spaceNode)
        translationSpan.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
      }
      translatedWrapperNode.appendChild(translationSpan)
    })
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}
