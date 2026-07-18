/**
 * 清洗 AI 产出的 CSS，移除危险内容。
 * 禁止：@import、外部 url()、expression()、behavior 属性
 */
export function sanitizeCss(css: string): string {
  return css
    // 移除 @import 规则（含多行变体）
    .replace(/@import\s+[^;]+;/gi, '/* @import removed */')
    // 移除 url() 中非 data: 协议的引用
    .replace(/url\(\s*(['"]?)\s*(?!data:)([^'")]+)\s*(['"]?)\s*\)/gi,
      '/* external url() removed */')
    // 移除 expression()（旧 IE 攻击向量）
    .replace(/expression\s*\([^)]*\)/gi, '/* expression removed */')
    // 移除 behavior 属性（旧 IE htc 引用）
    .replace(/behavior\s*:\s*[^;]+;/gi, '/* behavior removed */')
    // 移除 -moz-binding（XBL 绑定攻击）
    .replace(/-moz-binding\s*:\s*[^;]+;/gi, '/* -moz-binding removed */')
}
