import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { Scene, SceneItemEvent, PlayerPhase, PlaybackSpeed, VideoRecordCard } from '@/types/scene'

export const useVideoLectureStore = defineStore('videoLecture', () => {
  // ===== 播放器生命周期 =====
  const phase = ref<PlayerPhase>('idle')
  const isOpen = computed(() => phase.value !== 'idle' && phase.value !== 'loading')

  // ===== 场景队列 =====
  const scenes = shallowRef<Scene[]>([])
  const currentSceneIndex = ref(0)
  const isStreamEnded = ref(false)

  const currentScene = computed(() => scenes.value[currentSceneIndex.value] ?? null)
  const hasPrevScene = computed(() => currentSceneIndex.value > 0)
  const hasNextScene = computed(() =>
    currentSceneIndex.value < scenes.value.length - 1 || !isStreamEnded.value
  )
  const sceneCount = computed(() => scenes.value.filter(s => s !== null).length)

  // ===== 播放控制 =====
  const isPlaying = ref(false)
  const speed = ref<PlaybackSpeed>(1.0)
  const currentSceneTime = ref(0) // 当前场景已播放时间(ms)

  // ===== 讲座元数据 =====
  const lectureId = ref('')
  const topic = ref('')

  // ===== 视频记录卡片 =====
  const lastRecord = ref<VideoRecordCard | null>(null)

  // ===== 回看标识——避免 phase=idle 误触关闭回调 =====
  const _isReplaying = ref(false)

  // ===== 已完成的场景索引——场景播完但未推进时记录，用于 receiveScene 自动恢复 =====
  const _lastCompletedSceneIndex = ref(-1)

  // ===== 方法 =====

  /** 开始加载——用户发送消息后调用 */
  function startLoading(t: string) {
    phase.value = 'loading'
    topic.value = t
    lectureId.value = `lec_${Date.now()}`
    scenes.value = []
    currentSceneIndex.value = 0
    isStreamEnded.value = false
    isPlaying.value = false
    currentSceneTime.value = 0
    _lastCompletedSceneIndex.value = -1
  }

  /** SSE 推送一个 Scene（保留空位不过滤 null，避免索引偏移错乱） */
  function receiveScene(event: SceneItemEvent) {
    const newScenes = [...scenes.value]
    const idx = event.sceneIndex
    while (newScenes.length <= idx) newScenes.push(null as any)
    newScenes[idx] = event.scene
    scenes.value = newScenes

    // 第一个 Scene 到达 → 触发暗场
    if (phase.value === 'loading' && newScenes.some(s => s !== null)) {
      phase.value = 'darkening'
    }

    // 缓冲中收到新场景 → 自动恢复播放
    if (phase.value === 'buffering') {
      onBufferedSceneArrive()
    }

    // 用户手动从 buffering 切到 playing 后收到新场景 → 自动推进
    if (phase.value === 'playing'
        && _lastCompletedSceneIndex.value === currentSceneIndex.value) {
      let nextIdx = currentSceneIndex.value + 1
      while (nextIdx < scenes.value.length && scenes.value[nextIdx] === null) nextIdx++
      if (nextIdx < scenes.value.length) {
        currentSceneIndex.value = nextIdx
        currentSceneTime.value = 0
        _lastCompletedSceneIndex.value = -1
      }
    }
  }

  /** 暗场完成 → 开始展开播放器 */
  function onDarkComplete() {
    if (phase.value === 'darkening') {
      phase.value = 'expanding'
    }
  }

  /** 展开动画完成 → 开始播放 */
  function onExpandComplete() {
    if (phase.value === 'expanding') {
      phase.value = 'playing'
      isPlaying.value = true
    }
  }

  /** 标记 SSE 流结束 */
  function markStreamEnded() {
    isStreamEnded.value = true
    // 如果当前在 buffering 等待最后一个场景，流已结束则直接切到 paused
    if (phase.value === 'buffering') {
      phase.value = 'paused'
    }
  }

  /** 播放/暂停 */
  function togglePlay() {
    if (phase.value === 'playing') {
      phase.value = 'paused'
      isPlaying.value = false
    } else if (phase.value === 'paused') {
      phase.value = 'playing'
      isPlaying.value = true
    } else if (phase.value === 'buffering') {
      phase.value = 'playing'
      isPlaying.value = true
    }
  }

  /** 下一场景（跳过 null 空位） */
  function nextScene() {
    let nextIdx = currentSceneIndex.value + 1
    while (nextIdx < scenes.value.length && scenes.value[nextIdx] === null) {
      nextIdx++
    }
    if (nextIdx < scenes.value.length) {
      _lastCompletedSceneIndex.value = -1
      currentSceneIndex.value = nextIdx
      currentSceneTime.value = 0
    }
    if (phase.value === 'paused' || phase.value === 'buffering') {
      phase.value = 'playing'
      isPlaying.value = true
    }
  }

  /** 上一场景（跳过 null 空位） */
  function prevScene() {
    let prevIdx = currentSceneIndex.value - 1
    while (prevIdx >= 0 && scenes.value[prevIdx] === null) {
      prevIdx--
    }
    if (prevIdx >= 0) {
      _lastCompletedSceneIndex.value = -1
      currentSceneIndex.value = prevIdx
      currentSceneTime.value = 0
    }
  }

  /** 跳转到指定场景 */
  function seekTo(index: number) {
    if (index >= 0 && index < scenes.value.length && scenes.value[index] !== null) {
      _lastCompletedSceneIndex.value = -1
      currentSceneIndex.value = index
      currentSceneTime.value = 0
    }
  }

  /** 时间跳转（±5s），返回是否成功 */
  function skipTime(deltaMs: number): boolean {
    const scene = currentScene.value
    if (!scene) return false
    const dur = scene.duration || 5000
    const newTime = currentSceneTime.value + deltaMs

    if (newTime >= dur) {
      // 超出当前场景 → 跳到下一场景开头
      nextScene()
      return true
    }
    if (newTime < 0) {
      if (hasPrevScene.value) {
        // 回退到上一场景末尾附近
        prevScene()
        const prev = currentScene.value
        if (prev) {
          currentSceneTime.value = Math.max(0, (prev.duration || 5000) - 500)
        }
        return true
      }
      currentSceneTime.value = 0
      return true
    }
    currentSceneTime.value = newTime
    return true
  }

  /** 循环倍速 */
  function cycleSpeed(): PlaybackSpeed {
    const speeds: PlaybackSpeed[] = [1.0, 1.25, 1.5, 2.0, 0.75]
    const idx = speeds.indexOf(speed.value)
    speed.value = speeds[(idx + 1) % speeds.length]
    return speed.value
  }

  /** 直接设置倍速 */
  function setSpeed(s: PlaybackSpeed) {
    speed.value = s
  }

  /** 当前场景播完回调 */
  function onSceneComplete() {
    let nextIdx = currentSceneIndex.value + 1
    while (nextIdx < scenes.value.length && scenes.value[nextIdx] === null) {
      nextIdx++
    }
    if (nextIdx < scenes.value.length) {
      // 直接推进到下一场景并播放
      _lastCompletedSceneIndex.value = -1
      currentSceneIndex.value = nextIdx
      currentSceneTime.value = 0
      phase.value = 'playing'
      isPlaying.value = true
    } else if (isStreamEnded.value) {
      phase.value = 'paused'
      isPlaying.value = false
      _lastCompletedSceneIndex.value = currentSceneIndex.value
    } else {
      phase.value = 'buffering'
      isPlaying.value = false
      _lastCompletedSceneIndex.value = currentSceneIndex.value
    }
  }

  /** 缓冲中收到新场景 */
  function onBufferedSceneArrive() {
    if (phase.value !== 'buffering') return
    let nextIdx = currentSceneIndex.value + 1
    while (nextIdx < scenes.value.length && scenes.value[nextIdx] === null) {
      nextIdx++
    }
    if (nextIdx >= scenes.value.length) return
    _lastCompletedSceneIndex.value = -1
    currentSceneIndex.value = nextIdx
    currentSceneTime.value = 0
    phase.value = 'playing'
    isPlaying.value = true
  }

  /** 关闭播放器，生成记录卡片 */
  function close(): VideoRecordCard {
    const card: VideoRecordCard = {
      type: 'video-record',
      lectureId: lectureId.value,
      topic: topic.value,
      sceneCount: sceneCount.value,
      lastSceneIndex: currentSceneIndex.value,
      completed: isStreamEnded.value && currentSceneIndex.value >= scenes.value.length - 1,
    }
    lastRecord.value = card
    phase.value = 'idle'
    isPlaying.value = false
    isStreamEnded.value = false
    return card
  }

  /** 回看——从卡片恢复播放，或从头重播当前讲解 */
  function replay(card?: VideoRecordCard) {
    if (card) {
      lectureId.value = card.lectureId
      topic.value = card.topic
      currentSceneIndex.value = Math.min(card.lastSceneIndex, Math.max(0, scenes.value.length - 1))
    } else {
      currentSceneIndex.value = 0
    }
    if (scenes.value.length === 0) return
    _lastCompletedSceneIndex.value = -1
    isPlaying.value = false
    currentSceneTime.value = 0
    phase.value = 'darkening'
  }

  /** 从记录卡片回看——先短暂 idle 重新挂载播放器，再进入 darkening */
  function replayFromCard(card: VideoRecordCard) {
    _isReplaying.value = true
    phase.value = 'idle'
    setTimeout(() => {
      replay(card)
      _isReplaying.value = false
    }, 80)
  }

  /** 完全重置 */
  function reset() {
    phase.value = 'idle'
    scenes.value = []
    currentSceneIndex.value = 0
    isStreamEnded.value = false
    isPlaying.value = false
    speed.value = 1.0
    currentSceneTime.value = 0
    lectureId.value = ''
    topic.value = ''
    _lastCompletedSceneIndex.value = -1
    _isReplaying.value = false
  }

  return {
    phase, isOpen, scenes, currentSceneIndex, isStreamEnded,
    currentScene, hasPrevScene, hasNextScene, sceneCount,
    isPlaying, speed, currentSceneTime,
    lectureId, topic, lastRecord,
    startLoading, receiveScene, onDarkComplete, onExpandComplete,
    markStreamEnded, togglePlay, nextScene, prevScene, seekTo,
    cycleSpeed, setSpeed, skipTime, onSceneComplete, onBufferedSceneArrive,
    close, replay, replayFromCard, reset, _isReplaying,
  }
})
