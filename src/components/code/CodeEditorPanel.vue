<template>
  <div ref="editorHost" class="code-editor-panel" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
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
import { RangeSetBuilder } from '@codemirror/state'

const props = defineProps<{
  content: string
  language: string
  readOnly: boolean
  highlightedLines: number[]
}>()

const emit = defineEmits<{
  (e: 'update:content', value: string): void
}>()

const editorHost = ref<HTMLElement | null>(null)
const view = shallowRef<EditorView | null>(null)
const languageCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

function languageExt(lang: string): Extension {
  const map: Record<string, () => Extension> = {
    python: () => python(),
    javascript: () => javascript(),
    java: () => java(),
    cpp: () => cpp(),
  }
  return (map[lang] ?? map.python)()
}

function lineHighlighter(lines: number[]) {
  const lineSet = new Set(lines)
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = this.build(view)
    }
    update(update: ViewUpdate) {
      this.decorations = this.build(update.view)
    }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>()
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
          const line = view.state.doc.lineAt(pos)
          if (lineSet.has(line.number)) {
            builder.add(line.from, line.from, Decoration.line({ class: 'cm-highlighted-line' }))
          }
          pos = line.to + 1
        }
      }
      return builder.finish()
    }
  }, { decorations: (v: any) => v.decorations })
}

onMounted(() => {
  if (!editorHost.value) return
  const state = EditorState.create({
    doc: props.content,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...lintKeymap,
      ]),
      languageCompartment.of(languageExt(props.language)),
      readOnlyCompartment.of(props.readOnly ? EditorState.readOnly.of(true) : []),
      lineHighlighter(props.highlightedLines),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          emit('update:content', update.state.doc.toString())
        }
      }),
      oneDark,
    ],
  })
  view.value = new EditorView({
    state,
    parent: editorHost.value,
  })
})

watch(() => props.content, (val) => {
  const v = view.value
  if (v && val !== v.state.doc.toString()) {
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: val },
    })
  }
})

watch(() => props.readOnly, (ro) => {
  view.value?.dispatch({
    effects: readOnlyCompartment.reconfigure(
      ro ? EditorState.readOnly.of(true) : []
    ),
  })
})

watch(() => props.language, (lang) => {
  view.value?.dispatch({
    effects: languageCompartment.reconfigure(languageExt(lang)),
  })
})

onUnmounted(() => {
  view.value?.destroy()
})
</script>

<style>
.code-editor-panel {
  border-radius: var(--lt-radius-md);
  overflow: hidden;
  border: 1px solid var(--lt-border);
}
.code-editor-panel .cm-editor {
  font-size: 14px;
  font-family: var(--lt-font-mono, 'JetBrains Mono', 'Fira Code', 'Consolas', monospace);
}
.code-editor-panel .cm-editor .cm-scroller {
  line-height: 1.6;
}
.cm-highlighted-line {
  background-color: rgba(124, 92, 252, 0.12) !important;
}
@media (max-width: 768px) {
  .code-editor-panel .cm-editor {
    font-size: 13px;
  }
}
</style>
