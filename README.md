# Chrome Phonetic Transcription Helper | 音标沉浸式助读插件

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

**音标沉浸式助读插件**是一款专为“看得懂英文，但读不准/不敢读”的英语学习者设计的 Chrome 浏览器扩展。它能够将网页上的英文文本无缝地双语/三语对照标注国际音标（IPA），让您在静音办公环境或碎片化阅读中，通过双眼扫视与脑内默读，潜移默化地建立准确的口语发音肌肉记忆。

本项目基于优秀的开源网页翻译工具 [Read Frog (陪读蛙)](https://github.com/mengxi-ream/read-frog) 进行二次开发。

---

## 💡 解决的核心痛点

* **“哑巴英语”与认知断层**：许多学习者具备极高的书面词汇量与阅读能力，但在口语表达和实时语音映射上存在断层。
* **静音办公环境限制**：在开放式办公室或公共场所，不便佩戴耳机或开启音频播放，阻碍了发音练习。
* **查词打断阅读心流**：传统的划词翻译或词典查询需要频繁点击弹窗，严重割裂了对长文逻辑的理解。

---

## ✨ 核心功能亮点

1. **多维对照模式**：
   * **纯音标对照**：仅展示“英文原文 + 国际音标（IPA）”，适合单纯的发音肌肉记忆练习。
   * **三维对照**：同时展示“英文原文 + 中文译文 + 国际音标”，兼顾内容深度理解与发音纠正。
2. **纯本地极致流畅（Zero Server Cost & Zero Latency）**：
   * 摒弃大语言模型（LLM）云端翻译的高延迟与高成本，采用 **纯本地 JavaScript 引擎**。
   * 基于浏览器内置 `Intl.Segmenter` 分词，轻量级 NLP 库 `compromise.js` 进行词性标注，以及本地高度压缩的 CMU 发音词典，实现毫秒级“即点即显”的注音体验。
3. **同形异义词（Homographs）智能识别**：
   * 基于语境的词性分析（POS Tagging），精准区分动词与名词的重音及音素差异。例如：*record*（动词 `/rɪˈkɔːrd/` vs 名词 `/ˈrɛkərd/`）。
4. **无损网页排版保护**：
   * 采用与 Read Frog 一致的智能 DOM 树保护机制。过滤代码块、输入框、第三方组件，采用包裹器（Wrapping）或 HTML5 `<ruby>`/`<rt>` 标签动态注入，不破坏网页原有事件与样式布局。
5. **智能动态监听**：
   * 使用 `MutationObserver` 实时监听网页变化，无缝适配无限滚动（Infinite Scroll）及 Ajax 动态加载内容。
6. **听觉纠音闭环**：
   * 深度联动 Read Frog 原生的 Edge AI 语音 TTS 引擎，双击或划词可高亮播放纯正美音/英音。

---

## 🛠 技术架构

插件底层使用 **WXT** 现代浏览器开发框架构建，结合 React/TypeScript。音标处理层完全运行在浏览器的后台工作线程（Web Worker）中。

关于核心模块、数据流逻辑及排版保护的详细技术设计，请参阅：
* 👉 **[技术架构设计说明书](file:///usr/local/google/home/lynneliu/Documents/chrome-phonetic-transcription-helper/docs/architecture.md)**

---

## 📅 项目规划与研发周期

项目计划在 **3-4 周** 内完成 MVP 验证、引擎升级到合规发布：

| 冲刺阶段 | 核心任务 | 交付里程碑 | 状态 |
| :--- | :--- | :--- | :--- |
| **Phase 1: MVP 验证** | 搭建 WXT 开发环境，改造 Popup UI 按钮，短路翻译链路并使用本地静态词典渲染音标。 | 实现基础音标盲匹配替换，跑通 DOM 注入闭环。 | ⏳ 规划中 |
| **Phase 2: 引擎升级** | 引入 NLP 词性标注解决同形异义词，处理词尾变形，完善 TTS 文本过滤与 CSS 样式精调。 | 上下文注音准确率达 95% 以上，支持多模式平滑切换。 | ⏳ 规划中 |
| **Phase 3: 测试发布** | SPA 页面压力测试，排查输入框污染，打包并发布至 Chrome / Edge Web Store。 | 产品官方商店上架，遵守 GPL-3.0 协议。 | ⏳ 规划中 |

---

## 🚀 快速上手 (开发指南)

### 环境依赖
* Node.js >= 22.0
* pnpm >= 9.0

### 本地运行与调试
1. 克隆仓库及子模块（如有）：
   ```bash
   git clone https://github.com/lynneliu/chrome-phonetic-transcription-helper.git
   cd chrome-phonetic-transcription-helper
   ```
2. 安装依赖：
   ```bash
   pnpm install
   ```
3. 启动开发模式：
   ```bash
   pnpm run dev
   ```
4. 打开 Chrome 浏览器，进入 `chrome://extensions/` 页面，开启“开发者模式”，选择“加载已解压的扩展程序”，指向项目生成的 `.wxt/chrome` 目录。

---

## 📄 许可证与致谢

* 本项目基于 [Read Frog (GPL-3.0)](https://github.com/mengxi-ream/read-frog) 二次开发。
* 核心词典数据衍生自 [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict)。
* 依照 **GPL-3.0 开源许可证**，本项目所有修改及后续代码将同样保持开源。
