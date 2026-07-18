import { apiFetch } from './api'
import type { ChatMessage } from '@/composables/useChatSSE'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\][(\[][^)\]]*[)\]]/g, '$1')
    .replace(/!\[.*?]\(.*?\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitSentences(text: string): string[] {
  const clean = stripMarkdown(text)
  return clean
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export interface TtsSentenceState {
  isPlaying: boolean
  isLoading: boolean
  current: number
  total: number
}

export function createTtsPlayer(
  msg: ChatMessage,
  onStateChange: (state: TtsSentenceState) => void,
) {
  const sentences: string[] =
    (msg as any)._ttsSentences ?? splitSentences(msg.text)
  ;(msg as any)._ttsSentences = sentences

  const urls: (string | null)[] =
    (msg as any)._ttsUrls ?? new Array(sentences.length).fill(null)
  ;(msg as any)._ttsUrls = urls

  let audioEl: HTMLAudioElement | null = null
  let stopped = false
  let idx = 0

  const state: TtsSentenceState = {
    isPlaying: false,
    isLoading: true,
    current: 0,
    total: sentences.length,
  }

  async function fetchSentence(i: number): Promise<string> {
    if (urls[i]) return urls[i]!
    const res = await apiFetch<{ audioUrl: string }>('/chat/tts', {
      method: 'POST',
      body: { text: sentences[i] },
    })
    if (!res.data?.audioUrl) throw new Error(res.message || '语音合成失败')
    urls[i] = res.data.audioUrl
    return urls[i]!
  }

  function playUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      audioEl = new Audio(url)
      audioEl.onended = () => {
        audioEl = null
        resolve()
      }
      audioEl.onerror = () => {
        audioEl = null
        resolve()
      }
      audioEl.play()
    })
  }

  async function start() {
    if (sentences.length === 0) return
    stopped = false
    idx = 0
    state.isPlaying = true
    state.isLoading = true
    state.current = 0
    onStateChange({ ...state })

    try {
      const initFetch = [fetchSentence(0)]
      if (sentences.length > 1) initFetch.push(fetchSentence(1))
      await Promise.allSettled(initFetch)
      state.isLoading = false
      onStateChange({ ...state })

      while (idx < sentences.length && !stopped) {
        state.current = idx
        onStateChange({ ...state })

        let url = urls[idx]
        if (!url) {
          try {
            url = await fetchSentence(idx)
          } catch {
            idx++
            continue
          }
        }

        const ahead = idx + 2
        if (ahead < sentences.length && !urls[ahead]) {
          fetchSentence(ahead).catch(() => {})
        }

        await playUrl(url)
        idx++
      }
    } finally {
      if (!stopped) {
        state.isPlaying = false
        state.isLoading = false
        state.current = 0
        onStateChange({ ...state })
      }
    }
  }

  function stop() {
    stopped = true
    state.isPlaying = false
    state.isLoading = false
    audioEl?.pause()
    audioEl = null
    onStateChange({ ...state })
  }

  return { start, stop }
}
