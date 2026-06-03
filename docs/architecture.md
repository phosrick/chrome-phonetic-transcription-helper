# 技术架构设计说明书 (Technical Architecture Design)

本项目是基于开源翻译工具 [Read Frog](https://github.com/mengxi-ream/read-frog) 的二次开发。本架构设计在保留原版 Read Frog 的 WXT 开发脚手架、设置同步与 TTS 发音能力的前提下，以**纯本地化、零延迟、零算力成本**为目标，设计并集成了一套高效的浏览器端英语音标注入方案。

---

## 1. 架构设计原则 (Design Principles)

* **客户端优先 (Client-Side First)**：全网页的音标转换如果在云端（如通过 LLM 或云端词典）进行，将产生极高昂的算力开销和网络延迟。因此，音标解析与词性标注必须 100% 在浏览器本地完成。
* **低侵入性 (Low Intrusion)**：扩展开发应最大限度复用 Read Frog 原有的 DOM 提取与排版结构，避免大面积重构，确保未来的上游合并（Upstream Merge）可能性。
* **心流保护 (Flow Protection)**：注音渲染的视觉层级必须为“辅助层”，使用低饱和度、小字号的 CSS 样式，避免干扰用户的正常英语阅读心流。
* **稳定性 (Robustness)**：智能识别富文本编辑器、代码块、输入框及复杂单页应用（SPA）的动态加载节点，确保插件绝不破坏页面原有功能与事件绑定。

---

## 2. 系统核心模块拆解 (System Decomposition)

系统划分为四个层次：**交互与配置层 (UI & State)**、**文本提取层 (DOM Extraction)**、**本地音标引擎层 (Phonetic Engine)** 以及 **样式注入层 (DOM Rendering & Styling)**。

```mermaid
graph TD
    User([用户点击 '音标对照']) --> CS[Content Script 唤醒]
    CS --> Lang[语言检测: 确认英文]
    Lang -- Yes --> DomExt[DOM 遍历与提取]
    DomExt --> Filter[黑名单过滤: code/input/style]
    Filter --> Chunk[智能分句切分 Chunks]
    Chunk --> Worker[Web Worker 线程池]
    
    subgraph Web Worker (本地解析层)
        Worker --> Seg[Intl.Segmenter 分词]
        Seg --> NLP[compromise.js 词性标注 POS]
        NLP --> Dict[CMU Dictionary Lookup]
        Dict --> Fallback[词缀变形降级匹配]
        Fallback --> Comb[IPA 音素重组]
    end
    
    Comb --> CS_Render[Content Script 接收结果]
    CS_Render --> DomInj[DOM 逆向注入]
    DomInj --> Style[CSS 柔和样式渲染]
    Style --> Rendered([用户看到原文+音标])
    
    CS_Render --> MutObs[MutationObserver 监听增量]
    MutObs --> DomExt
```

### 2.1 交互与配置层 (UI & State)
* **Popup / Sidepanel UI**：在原有“Translate”按钮旁新增“Phonetic”按钮，并在配置面板中新增模式切换的开关组合（音标、翻译、双语、三语）。
* **Options Page**：允许用户自定义音标的显示偏好（音标位置：单词上方、单词后方、段落下方；音标字号、透明度）。
* **WXT Storage**：使用扩展本地存储持久化用户的偏好状态，并在 Content Script 载入时自动同步。

### 2.2 文本提取层 (DOM Extraction)
* **Language Detector**：分析 DOM `lang` 属性及段落文本特征，避免在非英文页面上触发无效的解析逻辑。
* **DOM Filter**：严格跳过特定标签（如 `<code>`, `<pre>`, `<input>`, `<textarea>`, `<script>`, `<style>`），避开页眉页脚及边栏广告等低价值文本区域。
* **Chunking Handler**：将长网页文本按照标点符号和物理段落切割为多段，包装成任务队列以防单次解析耗时过长导致主线程阻塞。

### 2.3 本地音标引擎层 (Phonetic Engine)
为了避免阻塞渲染，引擎将运行在 **Web Worker** 中，完成以下流水线处理：
1. **分词 (Tokenization)**：调用浏览器原生且高性能的 `Intl.Segmenter` API，识别单词边界并剥离标点符号。
2. **词性标注 (POS Tagging)**：集成轻量级 NLP 库 `compromise.js`（约 200KB），为上下文单词标注词性（如名/动/副/代词等）。
3. **词典检索 (Dictionary Lookup)**：检索打包在插件内的 CMU 发音词典（高度压缩为 Trie 树或 Binary-search JSON 结构）。
4. **降级推导 (Fallback Engine)**：针对复数 `-s`、过去式 `-ed`、进行时 `-ing` 等派生词，若词典未直接命中，则自动剥离词尾进行词根查找并重新组装音标。

### 2.4 样式注入层 (DOM Rendering & Styling)
* **DOM Wrapping**：使用自定义 HTML5 元素（如 `<read-frog-phonetic>`）包裹目标文本节点。
* **Flexible Styles**：
  * **Ruby 模式**：通过 HTML5 `<ruby>` 与 `<rt>` 标签将音标悬浮于单词正上方，完美贴合网页行高。
  * **Inline 模式**：通过 `<span>` 元素将音标作为相邻节点插入单词后方，并以斜体/淡灰色渲染。
  * **Block 模式**：在段落末尾整体追加音标译文块。

---

## 3. 核心算法与数据流逻辑 (Core Algorithms & Data Flow)

### 3.1 同形异义词解析 (Homograph Resolution)
部分英文单词的读音随词性变化而不同。引擎利用 `compromise.js` 快速分析句子语法结构，并根据匹配的词性输出对应的音标：

```javascript
// 示例处理逻辑
import nlp from 'compromise';

function getIpaForWord(word, contextSentence) {
  const doc = nlp(contextSentence);
  const term = doc.termList().find(t => t.clean === word.toLowerCase());
  const pos = term ? term.tags : [];
  
  if (word.toLowerCase() === 'record') {
    if (pos.includes('Verb')) return 'rɪˈkɔːrd'; // 动词音标
    if (pos.includes('Noun')) return 'ˈrɛkərd';  // 名词音标
  }
  
  // 默认词典查询
  return cmuDict[word.toLowerCase()] || fallbackDerivation(word);
}
```

### 3.2 派生词降级推导算法 (Morphological Fallback)
由于本地词典文件大小受限，无法穷尽所有派生词。当本地词典未直接命中时，执行以下策略：
1. **去除尾缀**：尝试依次去除常见的后缀（`-s`, `-es`, `-ed`, `-ing`, `-ly`）。
2. **检索词根**：检索词根的音标。
3. **音标拼装**：若词根命中，根据剥离的后缀类别拼接对应的尾音音标（如：过去式 `-ed` 依据词尾清浊音转化为 `/t/`, `/d/` 或 `/ɪd/`）。

---

## 4. DOM 排版保护与 MutationObserver 机制

为了支持无限滚动（如 Twitter/Reddit）或异步加载网页，使用 `MutationObserver` 监听增量文本：

```javascript
const observer = new MutationObserver((mutations) => {
  let newTexts = [];
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        // 递归提取合法 Text Node，避开 script/code/input 等
        extractTextNodes(node, newTexts);
      });
    }
  }
  if (newTexts.length > 0) {
    // 派发给 Web Worker 批量注音
    dispatchToWorker(newTexts);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

---

## 5. 性能与体积调优 (Performance & Asset Optimization)

* **词典压缩 (Dictionary Compression)**：
  * 完整的 CMU 词典超过 10MB。我们对其进行精简，仅保留常用词汇，并通过前缀树（Trie）或 Gzip 级别的哈希映射，将词典体积压缩在 **1.5MB** 以内。
  * 词典数据仅在 Worker 初始化时加载进内存，不占用主线程资源。
* **内存隔离**：所有 NLP 解析（`compromise.js`）及词表查询均在后台 Web Worker 中异步执行。内容脚本与 Worker 间通过结构化克隆（Structured Clone）快速传递 JSON 负载，UI 响应延迟被控制在 **20ms** 以内。
