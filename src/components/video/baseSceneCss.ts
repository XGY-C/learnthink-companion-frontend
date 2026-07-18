/**
 * Base CSS 注入到 Shadow DOM 内
 * 包含：主题变量 + 入场动画 keyframes + 退场动画 + Web Component 基础样式
 */
export const BASE_SCENE_CSS = `
/* ===== 主题变量 ===== */
:host {
  --lt-bg: #0d0d12;
  --lt-bg-secondary: #1a1a24;
  --lt-text: #e8e8ec;
  --lt-text-secondary: #9ca3af;
  --lt-brand: #2B6FFF;
  --lt-brand-dark: #1a5ad7;
  --lt-accent: #FF8C42;
  --lt-success: #22c55e;
  --lt-error: #ef4444;
  --lt-border: rgba(255, 255, 255, 0.08);
  --lt-code-bg: #0d1117;
  --lt-font: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --lt-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.scene-root {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(ellipse at 70% 15%, rgba(43, 111, 255, 0.08), transparent 55%),
    radial-gradient(ellipse at 20% 85%, rgba(255, 140, 66, 0.05), transparent 55%),
    radial-gradient(ellipse at 50% 50%, #14141f 0%, #0d0d12 65%, #08080c 100%);
  color: var(--lt-text);
  font-family: var(--lt-font);
  overflow: hidden;
  position: relative;
}

/* ===== 入场动画 ===== */
[data-enter="fade"] {
  opacity: 0;
  transition: opacity 0.6s ease;
}
[data-enter="fade"][data-entered] { opacity: 1; }

[data-enter="fade-up"] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
[data-enter="fade-up"][data-entered] {
  opacity: 1;
  transform: translateY(0);
}

[data-enter="slide-left"] {
  opacity: 0;
  transform: translateX(-32px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-enter="slide-left"][data-entered] {
  opacity: 1;
  transform: translateX(0);
}

[data-enter="slide-right"] {
  opacity: 0;
  transform: translateX(32px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-enter="slide-right"][data-entered] {
  opacity: 1;
  transform: translateX(0);
}

[data-enter="slide-up"] {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-enter="slide-up"][data-entered] {
  opacity: 1;
  transform: translateY(0);
}

[data-enter="grow"] {
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-enter="grow"][data-entered] {
  opacity: 1;
  transform: scale(1);
}

[data-enter="pop"] {
  opacity: 0;
  transform: scale(0.3);
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
[data-enter="pop"][data-entered] {
  opacity: 1;
  transform: scale(1);
}

[data-enter="draw"] {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  transition: stroke-dashoffset 1.2s ease;
}
[data-enter="draw"][data-entered] {
  stroke-dashoffset: 0;
}

/* type-out 由 JS 逐行控制，CSS 只定义单行过渡 */
[data-enter="type-out"] .lt-code-line {
  opacity: 0;
  transition: opacity 0.3s ease;
}
[data-enter="type-out"] .lt-code-line.visible {
  opacity: 1;
}

/* custom: AI 在 CSS 中自定义 [data-entered] 动画 */
/* 默认隐藏态，AI 只需定义 [data-entered] 的终态即可 */
[data-enter="custom"] {
  opacity: 0;
  transition: opacity 0.6s ease;
}
[data-enter="custom"][data-entered] {
  opacity: 1;
}

/* ===== 退场动画 ===== */
[data-exit="fade-out"][data-exited] {
  opacity: 0;
  transition: opacity 0.4s ease;
}

/* ===== Web Component 基础样式 ===== */
lt-code {
  display: block;
  background: var(--lt-code-bg);
  border-radius: 10px;
  overflow: hidden;
  font-family: var(--lt-font-mono);
}
lt-code .lt-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: var(--lt-text-secondary);
  text-transform: lowercase;
}
lt-code .lt-code-lang { font-size: 12px; }
lt-code .lt-code-dots {
  display: flex;
  gap: 6px;
}
lt-code .lt-code-dots .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
lt-code .lt-code-dots .dot-red { background: #ff5f56; }
lt-code .lt-code-dots .dot-yellow { background: #ffbd2e; }
lt-code .lt-code-dots .dot-green { background: #27c93f; }
lt-code pre {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.6;
}
lt-code .lt-code-line {
  display: block;
}

/* ===== highlight.js 语法高亮主题 (GitHub Dark) ===== */
lt-code .hljs-keyword,
lt-code .hljs-built_in,
lt-code .hljs-type {
  color: #ff7b72;
}
lt-code .hljs-string,
lt-code .hljs-meta .hljs-string,
lt-code .hljs-regexp {
  color: #a5d6ff;
}
lt-code .hljs-comment,
lt-code .hljs-quote {
  color: #6e7681;
  font-style: italic;
}
lt-code .hljs-number,
lt-code .hljs-literal,
lt-code .hljs-boolean {
  color: #79c0ff;
}
lt-code .hljs-title,
lt-code .hljs-title.function_,
lt-code .hljs-section {
  color: #d2a8ff;
}
lt-code .hljs-params {
  color: #ffa657;
}
lt-code .hljs-attr,
lt-code .hljs-attribute,
lt-code .hljs-property,
lt-code .hljs-meta {
  color: #79c0ff;
}
lt-code .hljs-operator,
lt-code .hljs-punctuation {
  color: #c9d1d9;
}
lt-code .hljs-variable,
lt-code .hljs-symbol {
  color: #ffa657;
}

lt-callout {
  display: block;
  padding: 16px 20px;
  border-radius: 10px;
  border-left: 3px solid var(--lt-brand);
  background: rgba(43, 111, 255, 0.08);
  font-size: 14px;
  line-height: 1.7;
}
lt-callout[type="info"] { border-left-color: var(--lt-brand); background: rgba(43, 111, 255, 0.08); }
lt-callout[type="warn"] { border-left-color: var(--lt-accent); background: rgba(255, 140, 66, 0.08); }
lt-callout[type="success"] { border-left-color: var(--lt-success); background: rgba(34, 197, 94, 0.08); }

lt-formula {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  font-size: 1.1rem;
}
lt-formula[inline] {
  display: inline-flex;
  padding: 0 2px;
  font-size: inherit;
  vertical-align: baseline;
}

lt-chart {
  display: block;
  width: 100%;
  min-height: 200px;
}

lt-table {
  display: block;
  width: 100%;
}
lt-table table {
  width: 100%;
  border-collapse: collapse;
}
lt-table th, lt-table td {
  padding: 10px 16px;
  border: 1px solid var(--lt-border);
  text-align: left;
  font-size: 14px;
}
lt-table th {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

lt-arrow {
  display: block;
  position: absolute;
  pointer-events: none;
}
lt-arrow svg {
  width: 100%;
  height: 100%;
}

lt-flowchart {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

lt-timeline {
  display: block;
  width: 100%;
}
lt-timeline .lt-timeline-container {
  position: relative;
  padding-left: 24px;
}
lt-timeline .lt-timeline-container::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--lt-border);
}
lt-timeline .lt-timeline-item {
  position: relative;
  padding: 12px 0 12px 16px;
}
lt-timeline .lt-timeline-dot {
  position: absolute;
  left: -20px;
  top: 18px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lt-brand);
  border: 2px solid var(--lt-bg);
}
lt-timeline .lt-timeline-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text);
}
lt-timeline .lt-timeline-desc {
  font-size: 13px;
  color: var(--lt-text-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
`
