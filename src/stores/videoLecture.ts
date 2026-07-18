import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { Scene, SceneItemEvent, PlayerPhase, PlaybackSpeed, VideoRecordCard, InteractiveConfig } from '@/types/scene'

export const useVideoLectureStore = defineStore('videoLecture', () => {
  // ===== 播放器生命周期 =====
  const phase = ref<PlayerPhase>('idle')
  const isOpen = computed(() => phase.value !== 'idle')

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

  // ===== 交互状态 =====
  const interactiveAnswered = ref(false)      // 用户是否已完成当前场景的交互
  const showInteractionPrompt = ref(false)     // 是否显示"请先选择答案"提示
  const interactionResult = ref<{ correct: boolean; selectedIds: string[] } | null>(null)
  let interactionPromptTimer: ReturnType<typeof setTimeout> | null = null

  // ===== 探索型交互状态 =====
  const interactionMode = ref<'quiz' | 'explore' | null>(null)
  const exploreHint = ref('')

  const currentInteractive = computed<InteractiveConfig | null>(() =>
    currentScene.value?.interactive ?? null
  )

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
    interactiveAnswered.value = false
    _clearInteractionPrompt()
    interactionResult.value = null
    interactionMode.value = null
    exploreHint.value = ''
  }

  /** SSE 推送一个 Scene（保留空位不过滤 null，避免索引偏移错乱） */
  function receiveScene(event: SceneItemEvent) {
    const newScenes = [...scenes.value]
    const idx = event.sceneIndex
    while (newScenes.length <= idx) newScenes.push(null as any)
    newScenes[idx] = event.scene

    // 诊断：记录收到的场景是否包含 interactive 字段
    if (event.scene && (event.scene as any).interactive) {
      console.log('[Interactive] SSE 收到交互场景:', {
        sceneIndex: idx,
        hasInteractive: !!(event.scene as any).interactive,
        interactiveKeys: Object.keys((event.scene as any).interactive),
      })
    }

    if (scenes.value[idx] !== event.scene) {
      scenes.value = newScenes
    }

    // 第一个 Scene 到达 -> 播放器在 loading 阶段已可见，直接进入展开
    if (phase.value === 'loading' && newScenes.some(s => s !== null)) {
      phase.value = 'expanding'
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
    // 流结束但未收到任何场景 -> 关闭播放器
    if (phase.value === 'loading') {
      phase.value = 'idle'
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
    } else if (phase.value === 'interactive-paused') {
      // 按交互类型分发：探索型直接继续，选择题型需先答题
      if (interactionMode.value === 'explore') confirmContinue()
      else resolveInteraction()
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
      interactiveAnswered.value = false
      _clearInteractionPrompt()
      interactionResult.value = null
      interactionMode.value = null
      exploreHint.value = ''
      currentSceneIndex.value = nextIdx
      currentSceneTime.value = 0
    }
    // 从 buffering/paused 恢复时自动播放；从交互暂停跳走时回到 paused，避免卡死
    if (phase.value === 'interactive-paused') {
      phase.value = 'paused'
    } else if (phase.value === 'paused' || phase.value === 'buffering') {
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
      interactiveAnswered.value = false
      _clearInteractionPrompt()
      interactionResult.value = null
      interactionMode.value = null
      exploreHint.value = ''
      currentSceneIndex.value = prevIdx
      currentSceneTime.value = 0
      // 从交互暂停跳走时，恢复到 paused 状态，避免卡死
      if (phase.value === 'interactive-paused') {
        phase.value = 'paused'
      }
    }
  }

  /** 跳转到指定场景 */
  function seekTo(index: number) {
    if (index >= 0 && index < scenes.value.length && scenes.value[index] !== null) {
      _lastCompletedSceneIndex.value = -1
      interactiveAnswered.value = false
      _clearInteractionPrompt()
      interactionResult.value = null
      interactionMode.value = null
      exploreHint.value = ''
      currentSceneIndex.value = index
      currentSceneTime.value = 0
      // 从交互暂停跳走时，恢复到 paused 状态，避免卡死
      if (phase.value === 'interactive-paused') {
        phase.value = 'paused'
      }
    }
  }

  /** 时间跳转（±5s），返回是否成功 */
  function skipTime(deltaMs: number): boolean {
    // 交互暂停状态下，跳转 = 切换场景
    if (phase.value === 'interactive-paused') {
      if (deltaMs > 0) nextScene()
      else prevScene()
      return true
    }

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
    // 场景有有效的交互配置 -> 进入交互暂停，等待用户答题
    const interactive = currentScene.value?.interactive
    if (interactive && interactive.question && interactive.options?.length && interactive.correctIds?.length && !interactiveAnswered.value) {
      console.log('[Interactive] 进入交互暂停:', {
        sceneIndex: currentSceneIndex.value,
        question: interactive.question,
        optionsCount: interactive.options.length,
        correctIds: interactive.correctIds,
      })
      interactionMode.value = 'quiz'
      phase.value = 'interactive-paused'
      isPlaying.value = false
      return
    }

    // 诊断：未进入交互暂停的原因
    if (interactive) {
      console.log('[Interactive] 场景有 interactive 但未触发:', {
        sceneIndex: currentSceneIndex.value,
        hasInteractive: !!interactive,
        hasQuestion: !!interactive.question,
        hasOptions: !!interactive.options?.length,
        hasCorrectIds: !!interactive.correctIds?.length,
        alreadyAnswered: interactiveAnswered.value,
        interactiveKeys: Object.keys(interactive),
      })
    }

    // 探索型交互：waitForUser=true，到 duration 暂停等用户操作
    if (currentScene.value?.waitForUser) {
      interactionMode.value = 'explore'
      exploreHint.value = currentScene.value.interactHint || '探索完成后点击继续'
      phase.value = 'interactive-paused'
      isPlaying.value = false
      return
    }

    // 无交互或已答完 -> 推进到下一场景
    advanceToNextScene()
  }

  /** 推进到下一场景（无交互检查） */
  function advanceToNextScene() {
    let nextIdx = currentSceneIndex.value + 1
    while (nextIdx < scenes.value.length && scenes.value[nextIdx] === null) {
      nextIdx++
    }
    if (nextIdx < scenes.value.length) {
      _lastCompletedSceneIndex.value = -1
      interactiveAnswered.value = false
      _clearInteractionPrompt()
      interactionResult.value = null
      interactionMode.value = null
      exploreHint.value = ''
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

  /** 尝试结束交互并继续播放--未答题则显示提示，3 秒后自动消失 */
  function resolveInteraction() {
    if (!interactiveAnswered.value) {
      showInteractionPrompt.value = true
      if (interactionPromptTimer) clearTimeout(interactionPromptTimer)
      interactionPromptTimer = setTimeout(() => {
        showInteractionPrompt.value = false
      }, 3000)
      return
    }
    _clearInteractionPrompt()
    advanceToNextScene()
  }

  /** 探索型：用户点击"继续" */
  function confirmContinue() {
    if (interactionMode.value !== 'explore') return
    interactionMode.value = null
    exploreHint.value = ''
    _clearInteractionPrompt()
    advanceToNextScene()
  }

  /** 用户完成答题时调用 */
  function setInteractionResult(selectedIds: string[]) {
    const config = currentInteractive.value
    if (!config || !config.correctIds || !config.options) return
    const correctIds = config.correctIds
    const correct = config.multiSelect
      ? selectedIds.length === correctIds.length &&
        selectedIds.every(id => correctIds.includes(id))
      : correctIds.includes(selectedIds[0])
    interactionResult.value = { correct, selectedIds }
    interactiveAnswered.value = true
    _clearInteractionPrompt()
  }

  // 关闭交互提示并清除定时器
  function _clearInteractionPrompt() {
    showInteractionPrompt.value = false
    if (interactionPromptTimer) {
      clearTimeout(interactionPromptTimer)
      interactionPromptTimer = null
    }
  }

  /** 关闭"请先选择答案"提示 */
  function dismissInteractionPrompt() {
    _clearInteractionPrompt()
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
    interactiveAnswered.value = false
    _clearInteractionPrompt()
    interactionResult.value = null
    interactionMode.value = null
    exploreHint.value = ''
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
    interactiveAnswered.value = false
    _clearInteractionPrompt()
    interactionResult.value = null
    interactionMode.value = null
    exploreHint.value = ''
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
    interactiveAnswered.value = false
    _clearInteractionPrompt()
    interactionResult.value = null
    interactionMode.value = null
    exploreHint.value = ''
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
    interactiveAnswered.value = false
    _clearInteractionPrompt()
    interactionResult.value = null
    interactionMode.value = null
    exploreHint.value = ''
  }

  return {
    phase, isOpen, scenes, currentSceneIndex, isStreamEnded,
    currentScene, hasPrevScene, hasNextScene, sceneCount,
    isPlaying, speed, currentSceneTime,
    interactiveAnswered, showInteractionPrompt, interactionResult, currentInteractive,
    interactionMode, exploreHint,
    lectureId, topic, lastRecord,
    startLoading, receiveScene, onDarkComplete, onExpandComplete,
    markStreamEnded, togglePlay, nextScene, prevScene, seekTo,
    cycleSpeed, setSpeed, skipTime, onSceneComplete, onBufferedSceneArrive,
    resolveInteraction, confirmContinue, setInteractionResult, dismissInteractionPrompt,
    close, replay, replayFromCard, reset, _isReplaying,
  }
})
