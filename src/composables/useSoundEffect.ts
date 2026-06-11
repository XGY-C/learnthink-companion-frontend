import { ref } from 'vue'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.25) {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime)
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + duration)
  } catch {
    // AudioContext not available
  }
}

export function useSoundEffect() {
  const enabled = ref(localStorage.getItem('lt-sound') !== 'false')

  function setEnabled(v: boolean) {
    enabled.value = v
    localStorage.setItem('lt-sound', String(v))
  }

  function playSelect() {
    if (!enabled.value) return
    beep(660, 0.08, 'sine', 0.15)
  }

  function playCorrect() {
    if (!enabled.value) return
    beep(523, 0.12, 'sine', 0.2)
    setTimeout(() => beep(659, 0.12, 'sine', 0.2), 90)
  }

  function playWrong() {
    if (!enabled.value) return
    beep(220, 0.25, 'sawtooth', 0.1)
  }

  function playSubmit() {
    if (!enabled.value) return
    beep(440, 0.08, 'sine', 0.15)
    setTimeout(() => beep(880, 0.12, 'sine', 0.15), 70)
  }

  function playCelebration() {
    if (!enabled.value) return
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sine', 0.2), i * 110))
  }

  function playStarEarn() {
    if (!enabled.value) return
    beep(880, 0.1, 'sine', 0.18)
    setTimeout(() => beep(1109, 0.12, 'sine', 0.18), 70)
  }

  return { enabled, setEnabled, playSelect, playCorrect, playWrong, playSubmit, playCelebration, playStarEarn }
}
