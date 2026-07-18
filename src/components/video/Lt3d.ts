/**
 * <lt-3d> Web Component — Three.js 3D 可视化
 *
 * 通过 data-data 属性接收场景 JSON 配置，使用 three.js 渲染。
 * 时间轴桥接：通过 data-vt 属性接收虚拟时间，驱动自动动画。
 * 生命周期对齐 lt-chart。
 */

import type * as ThreeModule from 'three'

interface Lt3dConfig {
  camera?: { pos: number[]; target?: number[]; fov?: number }
  objects?: Lt3dObject[]
  lights?: Lt3dLight[]
  anim?: { type: string; speed: number; axis?: string }
  controls?: boolean
  axes?: boolean
  background?: string
}

interface Lt3dObject {
  type: string
  pos?: number[]
  rot?: number[]
  scale?: number
  color?: string
  opacity?: number
  wireframe?: boolean
  label?: string
  // cube
  size?: number | number[]
  // sphere/cylinder/cone
  r?: number
  // cylinder/cone
  h?: number
  // plane
  w?: number
  // torus
  tube?: number
  // line
  from?: number[]
  to?: number[]
  // points
  positions?: number[]
}

interface Lt3dLight {
  type: string
  intensity?: number
  pos?: number[]
  color?: string
}

export class Lt3d extends HTMLElement {
  private renderer: ThreeModule.WebGLRenderer | null = null
  private scene: ThreeModule.Scene | null = null
  private camera: ThreeModule.PerspectiveCamera | null = null
  private controls: any = null
  private resizeObserver: ResizeObserver | null = null
  private animState: { type: string; speed: number; axis: string } | null = null
  private lastVirtualTime = 0
  private rendering = false

  // 动态加载的模块引用
  private THREE: typeof ThreeModule | null = null
  private OrbitControlsClass: any = null

  static get observedAttributes() {
    return ['data-data', 'data-vt']
  }

  connectedCallback() {
    this.render3d()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this)
  }

  attributeChangedCallback(name: string, _old: string, value: string) {
    if (name === 'data-vt') {
      this.lastVirtualTime = parseFloat(value) || 0
      this.updateAnim()
      this.drawFrame()
    } else if (name === 'data-data' && this.isConnected) {
      this.render3d()
    }
  }

  disconnectedCallback() {
    this.dispose()
  }

  /** 解析 data-data 并（重建）渲染 3D 场景 */
  private async render3d() {
    if (this.rendering) return
    this.rendering = true
    try {
      const config = this.parseConfig()
      if (!config) {
        this.rendering = false
        return
      }
      this.disposeScene()
      await this.initThree(config)
      this.animState = config.anim ?? null
      this.drawFrame()
    } catch (e) {
      console.warn('lt-3d render error:', e)
      this.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--lt-text-secondary);font-size:14px;">3D 场景加载失败</div>'
    } finally {
      this.rendering = false
    }
  }

  private parseConfig(): Lt3dConfig | null {
    const raw = this.getAttribute('data-data')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      console.warn('lt-3d: invalid data-data JSON')
      return null
    }
  }

  /** 动态加载 three.js，对齐 lt-chart 的懒加载模式 */
  private async loadThree(): Promise<void> {
    if (this.THREE) return
    this.THREE = await import('three')
    const controlsModule = await import('three/examples/jsm/controls/OrbitControls')
    this.OrbitControlsClass = controlsModule.OrbitControls
  }

  /** 初始化 three.js 场景 */
  private async initThree(config: Lt3dConfig) {
    await this.loadThree()
    const THREE = this.THREE!
    this.innerHTML = ''

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    this.appendChild(canvas)

    const w = this.offsetWidth || this.parentElement?.offsetWidth || 800
    const h = this.offsetHeight || this.parentElement?.offsetHeight || 450

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()

    // 相机
    const camCfg = config.camera || {}
    const fov = camCfg.fov || 50
    this.camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 1000)
    this.camera.position.set(
      camCfg.pos?.[0] ?? 0,
      camCfg.pos?.[1] ?? 3,
      camCfg.pos?.[2] ?? 8
    )
    const target = camCfg.target || [0, 0, 0]
    this.camera.lookAt(target[0], target[1], target[2])

    // 光照
    for (const lightCfg of config.lights || []) {
      this.addLight(THREE, lightCfg)
    }
    // 默认光照
    if (!config.lights || config.lights.length === 0) {
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
      dirLight.position.set(5, 5, 5)
      this.scene.add(dirLight)
    }

    // 几何体
    for (const objCfg of config.objects || []) {
      this.addObject(THREE, objCfg)
    }

    // 坐标轴辅助线
    if (config.axes) {
      this.scene.add(new THREE.AxesHelper(3))
    }

    // OrbitControls
    if (config.controls && this.OrbitControlsClass) {
      this.controls = new this.OrbitControlsClass(this.camera!, this.renderer!.domElement)
      this.controls.enableDamping = false
      this.controls.addEventListener('change', () => this.drawFrame())
    }
  }

  private addLight(THREE: typeof ThreeModule, cfg: Lt3dLight) {
    const intensity = cfg.intensity ?? 1
    const color = this.resolveColor(cfg.color) || 0xffffff
    switch (cfg.type) {
      case 'ambient':
        this.scene!.add(new THREE.AmbientLight(color, intensity))
        break
      case 'point': {
        const light = new THREE.PointLight(color, intensity)
        if (cfg.pos) light.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
        this.scene!.add(light)
        break
      }
      case 'directional': {
        const light = new THREE.DirectionalLight(color, intensity)
        if (cfg.pos) light.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
        this.scene!.add(light)
        break
      }
    }
  }

  private addObject(THREE: typeof ThreeModule, cfg: Lt3dObject) {
    const color = this.resolveColor(cfg.color) || '#2B6FFF'
    const opacity = cfg.opacity ?? 1
    const wireframe = cfg.wireframe ?? false
    const material = new THREE.MeshStandardMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      wireframe,
    })

    let mesh: THREE.Mesh | null = null

    switch (cfg.type) {
      case 'cube': {
        const size = cfg.size
        const [sx, sy, sz] = Array.isArray(size) ? size : [size || 1, size || 1, size || 1]
        mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material)
        break
      }
      case 'sphere':
        mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.r || 1, 32, 32), material)
        break
      case 'cylinder':
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r || 1, cfg.r || 1, cfg.h || 2, 32), material)
        break
      case 'cone':
        mesh = new THREE.Mesh(new THREE.ConeGeometry(cfg.r || 1, cfg.h || 2, 32), material)
        break
      case 'plane':
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w || 4, cfg.h || 4), material)
        break
      case 'torus':
        mesh = new THREE.Mesh(new THREE.TorusGeometry(cfg.r || 1, cfg.tube || 0.3, 16, 32), material)
        break
      case 'line': {
        if (cfg.from && cfg.to) {
          const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(cfg.from[0], cfg.from[1], cfg.from[2]),
            new THREE.Vector3(cfg.to[0], cfg.to[1], cfg.to[2]),
          ])
          const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }))
          if (cfg.pos) line.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
          this.scene!.add(line)
        }
        return
      }
      case 'points': {
        if (cfg.positions && cfg.positions.length >= 3) {
          const arr = new Float32Array(cfg.positions)
          const geom = new THREE.BufferGeometry()
          geom.setAttribute('position', new THREE.BufferAttribute(arr, 3))
          const pts = new THREE.Points(geom, new THREE.PointsMaterial({ color, size: 0.1 }))
          if (cfg.pos) pts.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
          this.scene!.add(pts)
        }
        return
      }
    }

    if (mesh) {
      if (cfg.pos) mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
      if (cfg.rot) mesh.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2])
      const s = cfg.scale ?? 1
      mesh.scale.set(s, s, s)
      this.scene!.add(mesh)

      // label
      if (cfg.label) {
        this.addLabel(THREE, mesh, cfg.label)
      }
    }
  }

  private addLabel(THREE: typeof ThreeModule, parent: THREE.Object3D, text: string) {
    // 用 CSS2DRenderer 太重，首期用 sprite 作为简易标注
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = '28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(text, 128, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.set(0, 1.5, 0)
    sprite.scale.set(2, 0.5, 1)
    parent.add(sprite)
  }

  /** 从 CSS 变量或直接色值解析颜色 */
  private resolveColor(colorStr: string | undefined): string | number | null {
    if (!colorStr) return null
    // CSS 变量
    if (colorStr.startsWith('var(')) {
      const varName = colorStr.match(/var\(([^)]+)\)/)?.[1]?.trim()
      if (varName) {
        const root = this.getRootNode() as ShadowRoot | Document
        const el = root instanceof ShadowRoot ? root.host : document.documentElement
        const resolved = getComputedStyle(el).getPropertyValue(varName).trim()
        if (resolved) return resolved
      }
      return null
    }
    return colorStr
  }

  private handleResize() {
    if (!this.renderer || !this.camera) return
    const w = this.offsetWidth || 800
    const h = this.offsetHeight || 450
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** 根据 virtualTime 更新自动动画 */
  private updateAnim() {
    if (!this.animState || this.animState.type === 'none' || !this.scene) return
    const t = this.lastVirtualTime / 1000
    const axis = (this.animState.axis as 'x' | 'y' | 'z') || 'y'

    if (this.animState.type === 'orbit') {
      this.scene.rotation[axis] = t * this.animState.speed
    }
    if (this.animState.type === 'spin') {
      this.scene.traverse((obj: any) => {
        if (obj.isMesh && obj !== this.scene) {
          obj.rotation[axis] = t * this.animState.speed
        }
      })
    }
  }

  /** 触发一帧渲染 */
  private drawFrame() {
    if (!this.renderer || !this.scene || !this.camera) return
    this.controls?.update()
    this.renderer.render(this.scene, this.camera)
  }

  /** 释放 3D 场景资源（geometry/material/controls），保留 renderer 复用 */
  private disposeScene() {
    this.controls?.dispose()
    this.controls = null
    this.scene?.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: any) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    this.scene = null
    this.camera = null
  }

  /** 完全释放 */
  private dispose() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.disposeScene()
    this.renderer?.dispose()
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
    this.renderer = null
    this.THREE = null
    this.OrbitControlsClass = null
  }
}
