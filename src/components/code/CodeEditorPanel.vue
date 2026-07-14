<template>
  <div ref="editorHost" class="code-editor-panel" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue'
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, gutter, GutterMarker
} from '@codemirror/view'
import { EditorState, Compartment, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import type { Extension } from '@codemirror/state'
import { Decoration, ViewPlugin, ViewUpdate } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'

export interface GutterMarkerDef {
  line: number
  type: 'entry' | 'breakpoint' | 'step-range'
  symbol: string
}

export interface GuidedBlankDef {
  line: number
  placeholder: string
  answer: string
}

const props = defineProps<{
  content: string
  language: string
  readOnly: boolean
  highlightedLines: number[]
  gutterMarkers?: GutterMarkerDef[]
  guidedBlanks?: GuidedBlankDef[]
  traceActiveLine?: number | null
}>()

const emit = defineEmits<{
  'update:content': [value: string]
  'selection-change': [info: { text: string; from: number; to: number; x: number; y: number } | null]
  'hover-variable': [info: { name: string; from: number; to: number; x: number; y: number } | null]
  'blank-change': [line: number, filled: string, correct: boolean]
  'gutter-click': [line: number]
}>()

const editorHost = ref<HTMLElement | null>(null)
const view = shallowRef<EditorView | null>(null)
const languageCompartment = new Compartment()
const readOnlyCompartment = new Compartment()
const gutterMarkersCompartment = new Compartment()
const guidedBlanksCompartment = new Compartment()
const traceLineCompartment = new Compartment()
const highlighterCompartment = new Compartment()

const LINE_HEIGHT = 22

const RESERVED = new Set([
  'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return',
  'import', 'from', 'as', 'in', 'not', 'and', 'or', 'is', 'None',
  'True', 'False', 'print', 'range', 'len', 'int', 'str', 'list',
  'dict', 'set', 'tuple', 'with', 'try', 'except', 'finally', 'raise',
  'lambda', 'yield', 'global', 'nonlocal', 'pass', 'break', 'continue',
  'self', 'async', 'await',
])

// ─── Language ───
function languageExt(lang: string): Extension {
  const map: Record<string, () => Extension> = {
    python: () => python(), javascript: () => javascript(),
    java: () => java(), cpp: () => cpp(),
  }
  return (map[lang] ?? map.python)()
}

// ─── Line Highlighter ───
function lineHighlighter(lines: number[]) {
  const lineSet = new Set(lines)
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.build(view) }
    update(update: ViewUpdate) { this.decorations = this.build(update.view) }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = view.state.doc.lineAt(pos)
          if (lineSet.has(line.number))
            builder.add(line.from, line.from, Decoration.line({ class: 'cm-highlighted-line' }))
          pos = line.to + 1
        }
      }
      return builder.finish()
    }
  }, { decorations: (v: any) => v.decorations })
}

// ─── Gutter Markers ───
class CustomGutterMarker extends GutterMarker {
  constructor(readonly symbol: string, readonly cls: string) { super() }
  toDOM() {
    const el = document.createElement('span')
    el.textContent = this.symbol
    el.className = this.cls
    return el
  }
}

function buildGutterExtension(markers: GutterMarkerDef[]): Extension {
  const markerSet = new Map<number, { symbol: string; cls: string }>()
  for (const m of markers) {
    const clsMap: Record<string, string> = {
      entry: 'cm-gutter-entry',
      breakpoint: 'cm-gutter-breakpoint',
      'step-range': 'cm-gutter-steprange',
    }
    markerSet.set(m.line, { symbol: m.symbol, cls: clsMap[m.type] || '' })
  }
  return gutter({
    class: 'cm-custom-gutter',
    lineMarker(view, line) {
      const m = markerSet.get(line.number)
      return m ? new CustomGutterMarker(m.symbol, m.cls) : null
    },
    initialSpan() { return 24 },
    domEventHandlers: {
      click(view, line, event) {
        emit('gutter-click', line.number)
        return true
      }
    }
  })
}

// ─── Guided Blanks ───
const blankMark = Decoration.mark({ class: 'cm-blank-input' })
const blankCorrect = Decoration.mark({ class: 'cm-blank-correct' })
const blankWrong = Decoration.mark({ class: 'cm-blank-wrong' })

function buildBlankExtension(blanks: GuidedBlankDef[]): Extension {
  const blankLineSet = new Set(blanks.map(b => b.line))
  const blankAnswers = new Map(blanks.map(b => [b.line, b.answer]))
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.buildDecos(view) }
    update(update: ViewUpdate) { this.decorations = this.buildDecos(update.view) }
    buildDecos(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()
      for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i)
        if (blankLineSet.has(i)) {
          const text = line.text
          const idx = text.indexOf('__')
          if (idx !== -1) {
            let endIdx = text.indexOf(')', idx)
            if (endIdx === -1) endIdx = text.length - idx
            const blankText = text.slice(idx, text.indexOf(' ', idx) !== -1 ? text.indexOf(' ', idx) : text.length)
            const ans = blankAnswers.get(i) || ''
            const isCorrect = text.includes(ans) && !text.includes('__')
            const cls = isCorrect ? 'cm-blank-correct' : 'cm-blank-input'
            builder.add(line.from + idx, line.from + idx + 1, Decoration.mark({ class: cls }))
          }
        }
      }
      return builder.finish()
    }
  }, { decorations: (v: any) => v.decorations })
}

// ─── Trace Active Line ───
function buildTraceLineExtension(line: number | null): Extension {
  if (line === null || line < 1) return []
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.buildDecos(view, line!) }
    update(update: ViewUpdate) { this.decorations = this.buildDecos(update.view, line!) }
    buildDecos(view: EditorView, targetLine: number) {
      if (targetLine < 1 || targetLine > view.state.doc.lines) return Decoration.none
      const l = view.state.doc.line(targetLine)
      const builder = new RangeSetBuilder<Decoration>()
      builder.add(l.from, l.from, Decoration.line({ class: 'cm-trace-active' }))
      return builder.finish()
    }
  }, { decorations: (v: any) => v.decorations })
}

// ─── Hover + Selection Events ───
function domEventExtensions(): Extension {
  return EditorView.domEventHandlers({
    mouseover(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false
      const word = view.state.wordAt(pos)
      if (!word) { emit('hover-variable', null); return false }
      const text = view.state.doc.sliceString(word.from, word.to)
      if (RESERVED.has(text) || /^\d+$/.test(text) || text.length < 2) {
        emit('hover-variable', null)
        return false
      }
      const coords = view.coordsAtPos(word.from)
      if (coords) {
        const editorRect = view.dom.getBoundingClientRect()
        emit('hover-variable', {
          name: text, from: word.from, to: word.to,
          x: coords.left, y: coords.top - 8,
        })
      }
      return false
    },
    mouseout(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) { emit('hover-variable', null); return false }
      return false
    },
  })
}

// ─── Build ───
onMounted(() => {
  if (!editorHost.value) return
  const state = EditorState.create({
    doc: props.content,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(), bracketMatching(), closeBrackets(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap, ...searchKeymap, ...lintKeymap]),
      languageCompartment.of(languageExt(props.language)),
      readOnlyCompartment.of(props.readOnly ? EditorState.readOnly.of(true) : []),
      highlighterCompartment.of(lineHighlighter(props.highlightedLines)),
      gutterMarkersCompartment.of(buildGutterExtension(props.gutterMarkers || [])),
      guidedBlanksCompartment.of(props.guidedBlanks?.length ? buildBlankExtension(props.guidedBlanks) : []),
      traceLineCompartment.of(buildTraceLineExtension(props.traceActiveLine ?? null)),
      EditorView.updateListener.of(update => {
        if (update.docChanged) emit('update:content', update.state.doc.toString())
        if (update.selectionSet) {
          const sel = update.state.selection.main
          if (!sel.empty) {
            const text = update.state.doc.sliceString(sel.from, sel.to)
            const coords = update.view.coordsAtPos(sel.from)
            if (coords) {
              emit('selection-change', { text, from: sel.from, to: sel.to, x: coords.right, y: coords.top })
            }
          } else {
            emit('selection-change', null)
          }
        }
      }),
      domEventExtensions(),
      oneDark,
    ],
  })
  view.value = new EditorView({ state, parent: editorHost.value })
})

watch(() => props.content, (val) => {
  const v = view.value
  if (v && val !== v.state.doc.toString()) {
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: val } })
  }
})
watch(() => props.readOnly, (ro) => {
  view.value?.dispatch({ effects: readOnlyCompartment.reconfigure(ro ? EditorState.readOnly.of(true) : []) })
})
watch(() => props.language, (lang) => {
  view.value?.dispatch({ effects: languageCompartment.reconfigure(languageExt(lang)) })
})
watch(() => props.highlightedLines, (lines) => {
  view.value?.dispatch({ effects: highlighterCompartment.reconfigure(lineHighlighter(lines)) })
})
watch(() => props.gutterMarkers, (markers) => {
  view.value?.dispatch({ effects: gutterMarkersCompartment.reconfigure(buildGutterExtension(markers || [])) })
}, { deep: true })
watch(() => props.guidedBlanks, (blanks) => {
  view.value?.dispatch({ effects: guidedBlanksCompartment.reconfigure(blanks?.length ? buildBlankExtension(blanks) : []) })
}, { deep: true })
watch(() => props.traceActiveLine, (line) => {
  view.value?.dispatch({ effects: traceLineCompartment.reconfigure(buildTraceLineExtension(line ?? null)) })
})

function scrollToLine(line: number) {
  const v = view.value
  if (!v || line < 1) return
  const doc = v.state.doc
  if (line > doc.lines) line = doc.lines
  const lineObj = doc.line(line)
  v.dispatch({
    selection: { anchor: lineObj.from },
    effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: 40 }),
  })
}

defineExpose({ scrollToLine })

onUnmounted(() => { view.value?.destroy() })
</script>

<style>
.code-editor-panel { border-radius: var(--lt-radius-md); overflow: hidden; border: 1px solid var(--lt-border); }
.code-editor-panel .cm-editor { font-size: 14px; font-family: var(--lt-font-mono, 'JetBrains Mono', 'Fira Code', 'Consolas', monospace); }
.code-editor-panel .cm-editor .cm-scroller { line-height: 1.6; }
.cm-highlighted-line { background-color: rgba(124, 92, 252, 0.12) !important; }
.cm-trace-active { background-color: rgba(16, 185, 129, 0.08) !important; }
.cm-trace-active .cm-gutterElement { border-left: 3px solid var(--lt-success); }

/* Custom gutter */
.cm-custom-gutter { width: 24px; min-width: 24px; }
.cm-gutter-entry { color: var(--lt-success); font-size: 10px; font-weight: bold; }
.cm-gutter-breakpoint { color: var(--lt-ai); font-size: 10px; }
.cm-gutter-steprange { color: var(--lt-brand); font-size: 9px; opacity: 0.6; }

/* Guided blanks */
.cm-blank-input { background: rgba(43, 111, 255, 0.08); border-bottom: 2px solid var(--lt-brand); }
.cm-blank-correct { background: rgba(52, 199, 89, 0.08); border-bottom: 2px solid var(--lt-success); }
.cm-blank-wrong { background: rgba(255, 59, 48, 0.08); border-bottom: 2px solid var(--lt-danger); }

@media (max-width: 768px) {
  .code-editor-panel .cm-editor { font-size: 13px; }
}
</style>
