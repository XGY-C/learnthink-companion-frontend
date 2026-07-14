/**
 * 链接卡片工具模块
 * 将 AI 回复中的独立链接转化为精美的卡片展示
 */

// ===== 类型定义 =====
export interface VideoInfo {
  platform: 'bilibili' | 'youtube' | 'icourse163' | 'xuetangx'
  platformLabel: string
  videoId: string
  embedUrl: string
  thumbnailUrl?: string
  brandColor: string
  /** 搜索卡片：直接设置标题（搜索关键词），跳过 API 获取 */
  title?: string
}

// ===== SVG 图标 =====
const ICONS = {
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  bilibili: `<svg viewBox="0 0 24 24" fill="#00A1D6"><path clip-rule="evenodd" d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z" fill-rule="evenodd"></path></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  icourse163: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>`,
  xuetangx: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM3 9l9-5 9 5-9 5-9-5z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
}

// ===== 工具函数 =====
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 检测 URL 是否为视频链接
 */
export function detectVideo(url: string): VideoInfo | null {
  // B站搜索: https://search.bilibili.com/all?keyword=xxx
  const biliSearchMatch = url.match(/search\.bilibili\.com\/all\?(?:[^&]*&)*?keyword=([^&]+)/)
  if (biliSearchMatch) {
    return {
      platform: 'bilibili',
      platformLabel: 'B站搜索',
      videoId: 'search',
      embedUrl: '',
      brandColor: '#00A1D6',
      title: decodeURIComponent(biliSearchMatch[1]),
    }
  }

  // YouTube搜索: https://www.youtube.com/results?search_query=xxx
  const ytSearchMatch = url.match(/youtube\.com\/results\?(?:[^&]*&)*?search_query=([^&]+)/)
  if (ytSearchMatch) {
    return {
      platform: 'youtube',
      platformLabel: 'YouTube搜索',
      videoId: 'search',
      embedUrl: '',
      brandColor: '#FF0000',
      title: decodeURIComponent(ytSearchMatch[1]),
    }
  }

  // 哔哩哔哩: https://www.bilibili.com/video/BVxxxx
  const biliMatch = url.match(/bilibili\.com\/video\/(BV[\w]+)/)
  if (biliMatch) {
    return {
      platform: 'bilibili',
      platformLabel: '哔哩哔哩',
      videoId: biliMatch[1],
      embedUrl: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&high_quality=1&autoplay=1`,
      brandColor: '#00A1D6',
    }
  }

  // YouTube: watch / shorts / youtu.be
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/)
  if (ytMatch) {
    return {
      platform: 'youtube',
      platformLabel: 'YouTube',
      videoId: ytMatch[1],
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      brandColor: '#FF0000',
    }
  }

  // 中国大学MOOC: https://www.icourse163.org/course/ZJU-1464119172 或 /learn/ZJU-1464119172
  const moocMatch = url.match(/icourse163\.org\/(?:course|learn)\/[\w-]+/)
  if (moocMatch) {
    // /learn/ 页面需要登录，统一转为 /course/ 供后端爬取
    const courseUrl = url.replace('/learn/', '/course/')
    return {
      platform: 'icourse163',
      platformLabel: '中国大学MOOC',
      videoId: courseUrl,
      embedUrl: '',
      brandColor: '#00b38a',
    }
  }

  // 学堂在线: https://www.xuetangx.com/course/zjsru0809bt0909/16912227
  const xtxMatch = url.match(/xuetangx\.com\/course\/[\w]+\/\d+/)
  if (xtxMatch) {
    return {
      platform: 'xuetangx',
      platformLabel: '学堂在线',
      videoId: url,
      embedUrl: '',
      brandColor: '#9b1c2e',
    }
  }

  return null
}

/**
 * 从 URL 中提取域名（去掉 www. 前缀）
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * 从 URL 中提取显示路径
 */
export function extractDisplayPath(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname
    if (path.length > 40) path = path.slice(0, 37) + '...'
    const query = u.search ? u.search.slice(0, 20) : ''
    return (path === '/' ? '' : path) + query
  } catch {
    return ''
  }
}

/**
 * 获取 favicon URL
 */
function getFaviconUrl(domain: string): string {
  return `https://${domain}/favicon.ico`
}

// ===== 卡片 HTML 生成 =====

/**
 * 生成文章链接卡片 HTML
 */
export function generateArticleCard(url: string): string {
  const domain = extractDomain(url)
  const displayPath = extractDisplayPath(url)
  const faviconUrl = getFaviconUrl(domain)

  return `<div class="lt-link-card lt-link-card--article" data-url="${escapeAttr(url)}">
    <div class="lt-link-card__icon">
      <img src="${escapeAttr(faviconUrl)}" alt="" class="lt-link-card__favicon-img" />
      <div class="lt-link-card__favicon-fallback">${ICONS.globe}</div>
    </div>
    <div class="lt-link-card__body">
      <div class="lt-link-card__title">${escapeHtml(domain)}</div>
      <div class="lt-link-card__meta">
        <span>文章</span>
        <span class="lt-link-card__dot"></span>
        <span>${escapeHtml(displayPath || '点击查看原文')}</span>
      </div>
    </div>
    <div class="lt-link-card__arrow">${ICONS.arrow}</div>
  </div>`
}

/**
 * 生成搜索链接卡片 HTML（紧凑布局，复用文章卡片样式）
 */
function generateSearchCard(url: string, video: VideoInfo): string {
  const platformIcon = video.platform === 'bilibili' ? ICONS.bilibili
    : video.platform === 'youtube' ? ICONS.youtube
    : ICONS.globe

  return `<div class="lt-link-card lt-link-card--article" data-url="${escapeAttr(url)}" style="--card-accent: ${escapeAttr(video.brandColor)};">
    <div class="lt-link-card__icon">
      <div class="lt-link-card__favicon-fallback" style="display: flex; color: ${escapeAttr(video.brandColor)};">${platformIcon}</div>
    </div>
    <div class="lt-link-card__body">
      <div class="lt-link-card__title">${escapeHtml(video.platformLabel)}</div>
      <div class="lt-link-card__meta">
        <span>搜索</span>
        <span class="lt-link-card__dot"></span>
        <span>${escapeHtml(video.title || '')}</span>
      </div>
    </div>
    <div class="lt-link-card__arrow">${ICONS.arrow}</div>
  </div>`
}

/**
 * 统一卡片生成：搜索链接 -> 紧凑卡片，视频链接 -> 视频卡片，其他 -> 文章卡片
 */
function generateLinkCard(url: string, video: VideoInfo | null): string {
  if (!video) return generateArticleCard(url)
  if (video.title) return generateSearchCard(url, video)
  return generateVideoCard(url, video)
}

/**
 * 生成视频链接卡片 HTML
 */
export function generateVideoCard(url: string, video: VideoInfo): string {
  const platformIcon = video.platform === 'bilibili' ? ICONS.bilibili
    : video.platform === 'youtube' ? ICONS.youtube
    : video.platform === 'icourse163' ? ICONS.icourse163
    : ICONS.xuetangx
  const isCourse = video.platform === 'icourse163' || video.platform === 'xuetangx'
  const metaLabel = isCourse ? '课程' : '视频'
  const actionLabel = isCourse ? '点击查看' : '点击播放'

  let thumbHtml: string
  if (video.thumbnailUrl) {
    // YouTube 有公开缩略图 API
    thumbHtml = `<img src="${escapeAttr(video.thumbnailUrl)}" alt="" class="lt-link-card__thumb-img" />
      <div class="lt-link-card__thumb-fallback">${platformIcon}</div>`
  } else {
    // B站缩略图通过 JSONP API 动态获取，初始用渐变占位
    thumbHtml = `<div class="lt-link-card__thumb-placeholder">${platformIcon}</div>`
  }

  return `<div class="lt-link-card lt-link-card--video" data-url="${escapeAttr(url)}" data-embed-url="${escapeAttr(video.embedUrl)}" data-platform="${escapeAttr(video.platform)}" data-video-id="${escapeAttr(video.videoId)}" style="--card-accent: ${escapeAttr(video.brandColor)};">
    <div class="lt-link-card__thumb">
      ${thumbHtml}
      <div class="lt-link-card__play-btn"><span class="lt-link-card__play-icon"></span></div>
    </div>
    <div class="lt-link-card__body">
      <div class="lt-link-card__badge">${platformIcon}<span>${escapeHtml(video.platformLabel)}</span></div>
      <div class="lt-link-card__video-title"></div>
      <div class="lt-link-card__meta">
        <span>${metaLabel}</span>
        <span class="lt-link-card__dot"></span>
        <span>${actionLabel}</span>
      </div>
    </div>
    <div class="lt-link-card__arrow">${ICONS.arrow}</div>
  </div>`
}

/**
 * 处理 HTML 中的链接，替换为卡片
 * 支持两种 AI 输出模式：
 * 1. 独立段落链接：<p><a href="URL">URL</a></p>
 * 2. 🔗 emoji 标记链接：描述文字\n🔗 <a href="URL">URL</a>（在 blockquote 或 p 内）
 * 2a. blockquote 内的链接：卡片移到 blockquote 外部，不再被引用边框包裹
 * 2b. 普通段落内的链接：卡片从 <p> 中拆分出来
 */
export function processLinkCards(html: string): string {
  // 模式 1：<p> 中仅包含一个自动链接化的 URL
  const standaloneRegex = /<p>\s*<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<\/p>/g
  html = html.replace(standaloneRegex, (match, url: string, text: string) => {
    if (!text.trim().startsWith('http')) return match
    const decodedUrl = decodeURIComponent(url)
    const video = detectVideo(decodedUrl)
    return generateLinkCard(decodedUrl, video)
  })

  // 模式 2a：🔗 链接在 blockquote 末尾 → 卡片移到 blockquote 外部
  // 匹配 🔗 <a>URL</a></p> [空白] </blockquote>，先关闭 p 和 blockquote，再插入卡片
  const blockquoteLinkRegex = /🔗\s*<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<\/p>\s*<\/blockquote>/g
  html = html.replace(blockquoteLinkRegex, (match, url: string, text: string) => {
    if (!text.trim().startsWith('http')) return match
    const decodedUrl = decodeURIComponent(url)
    const video = detectVideo(decodedUrl)
    const cardHtml = generateLinkCard(decodedUrl, video)
    return `</p></blockquote>${cardHtml}`
  })

  // 模式 2b：🔗 链接在普通 <p> 内（非 blockquote） → 卡片从 <p> 中拆分
  const emojiLinkRegex = /🔗\s*<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g
  html = html.replace(emojiLinkRegex, (match, url: string, text: string) => {
    if (!text.trim().startsWith('http')) return match
    const decodedUrl = decodeURIComponent(url)
    const video = detectVideo(decodedUrl)
    const cardHtml = generateLinkCard(decodedUrl, video)
    return `</p>${cardHtml}<p>`
  })

  // 模式 3：🔗 作为链接文本（AI 表格格式：<a href="URL">🔗</a>）
  // 替换为带域名/平台标签的 inline 芯片，不破坏表格布局
  const chipLinkRegex = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>\s*🔗\s*<\/a>/g
  html = html.replace(chipLinkRegex, (_match, url: string) => {
    const decodedUrl = decodeURIComponent(url)
    const video = detectVideo(decodedUrl)
    const label = video ? video.platformLabel : extractDomain(decodedUrl)
    return `<a href="${escapeAttr(decodedUrl)}" class="lt-link-chip" target="_blank" rel="noopener noreferrer">🔗 <span>${escapeHtml(label)}</span></a>`
  })

  // 模式 4：<li> 内的链接（AI 列表格式：<li>...<a href="URL">TEXT</a>...</li>）
  // 视频链接 -> 全尺寸卡片（li 去 bullet）；文章链接 -> inline 芯片
  const liLinkRegex = /<li>([\s\S]*?)<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>([\s\S]*?)<\/li>/g
  html = html.replace(liLinkRegex, (match, before, url, _text, after) => {
    if (match.includes('lt-link-chip') || match.includes('lt-link-card')) return match
    const decodedUrl = decodeURIComponent(url)
    const video = detectVideo(decodedUrl)

    if (video) {
      // 视频/搜索链接：生成卡片，li 去掉 bullet
      const cardHtml = generateLinkCard(decodedUrl, video)
      return `<li style="list-style:none;">${before}${cardHtml}${after}</li>`
    }

    // 文章链接：inline 芯片
    const domain = extractDomain(decodedUrl)
    const chipHtml = `<a href="${escapeAttr(decodedUrl)}" class="lt-link-chip" target="_blank" rel="noopener noreferrer">🔗 <span>${escapeHtml(domain)}</span></a>`
    return `<li>${before}${chipHtml}${after}</li>`
  })

  // 清理拆分后可能产生的空 <p></p>
  html = html.replace(/<p>\s*<\/p>/g, '')

  return html
}

// ===== 视频元数据缓存（缓存 Promise 避免并发重复请求） =====
const videoMetaCache = new Map<string, Promise<{ title: string; pic?: string }>>()

/**
 * 获取 B站视频信息（标题 + 封面）
 * 策略：先 fetch（B站 API 对部分来源支持 CORS），失败则 JSONP 兜底
 */
function fetchBilibiliInfo(bvid: string): Promise<{ title: string; pic: string }> {
  if (videoMetaCache.has(bvid)) {
    return videoMetaCache.get(bvid)! as Promise<{ title: string; pic: string }>
  }

  const promise = (async (): Promise<{ title: string; pic: string }> => {
    // 通过后端代理获取（避免 CORS）
    try {
      const resp = await fetch(`/api/video-info?platform=bilibili&videoId=${bvid}`)
      const json = await resp.json()
      if (json?.code === 0 && json?.data) {
        return { title: json.data.title as string, pic: json.data.thumbnail as string }
      }
    } catch { /* 后端代理失败，尝试 JSONP */ }

    // JSONP 直连 B站 API（兜底）
    return new Promise((resolve, reject) => {
      const cbName = `__bili_cb_${bvid}_${Date.now()}`
      const script = document.createElement('script')
      const cleanup = () => {
        try { delete (window as any)[cbName] } catch { /* noop */ }
        script.remove()
      }
      script.src = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}&jsonp=jsonp&callback=${cbName}`
      script.onerror = () => { cleanup(); reject(new Error('JSONP failed')) }
      ;(window as any)[cbName] = (data: any) => {
        cleanup()
        if (data?.code === 0 && data?.data) {
          resolve({ title: data.data.title as string, pic: data.data.pic as string })
        } else {
          reject(new Error('API error'))
        }
      }
      document.head.appendChild(script)
      setTimeout(() => {
        if ((window as any)[cbName]) { cleanup(); reject(new Error('Timeout')) }
      }, 6000)
    })
  })()

  videoMetaCache.set(bvid, promise)
  // 失败时清除缓存，允许重试
  promise.catch(() => videoMetaCache.delete(bvid))
  return promise
}

/**
 * 获取 YouTube 视频标题（通过 oEmbed API）
 */
function fetchYouTubeInfo(videoId: string): Promise<{ title: string }> {
  if (videoMetaCache.has(videoId)) {
    return videoMetaCache.get(videoId)! as Promise<{ title: string }>
  }

  const promise = (async () => {
    // 通过后端代理获取
    const resp = await fetch(`/api/video-info?platform=youtube&videoId=${videoId}`)
    const json = await resp.json()
    if (json?.code === 0 && json?.data) {
      return { title: json.data.title as string }
    }
    throw new Error('YouTube info fetch failed')
  })()

  videoMetaCache.set(videoId, promise)
  promise.catch(() => videoMetaCache.delete(videoId))
  return promise
}

/**
 * 获取中国大学MOOC课程信息（标题 + 封面）
 * 通过后端代理爬取课程页面
 */
function fetchIcourse163Info(url: string): Promise<{ title: string; pic: string }> {
  if (videoMetaCache.has(url)) {
    return videoMetaCache.get(url)! as Promise<{ title: string; pic: string }>
  }

  const promise = (async (): Promise<{ title: string; pic: string }> => {
    const resp = await fetch(`/api/video-info?platform=icourse163&videoId=${encodeURIComponent(url)}`)
    const json = await resp.json()
    if (json?.code === 0 && json?.data) {
      return { title: json.data.title as string, pic: json.data.thumbnail as string }
    }
    throw new Error('icourse163 info fetch failed')
  })()

  videoMetaCache.set(url, promise)
  promise.catch(() => videoMetaCache.delete(url))
  return promise
}

/**
 * 获取学堂在线课程信息（标题，封面无法获取）
 * 通过后端代理爬取课程页面 meta 标签
 */
function fetchXuetangxInfo(url: string): Promise<{ title: string; pic: string }> {
  if (videoMetaCache.has(url)) {
    return videoMetaCache.get(url)! as Promise<{ title: string; pic: string }>
  }

  const promise = (async (): Promise<{ title: string; pic: string }> => {
    const resp = await fetch(`/api/video-info?platform=xuetangx&videoId=${encodeURIComponent(url)}`)
    const json = await resp.json()
    if (json?.code === 0 && json?.data) {
      return { title: json.data.title as string, pic: json.data.thumbnail as string }
    }
    throw new Error('xuetangx info fetch failed')
  })()

  videoMetaCache.set(url, promise)
  promise.catch(() => videoMetaCache.delete(url))
  return promise
}

/**
 * 初始化链接卡片交互（在 v-html 渲染后调用）
 * - 文章卡片：点击打开新窗口
 * - 视频卡片：点击展开嵌入式播放器
 * - favicon/缩略图加载失败：显示 fallback 图标
 * - 视频元数据（标题/封面）自动抓取
 */
export function initLinkCardInteractions(container: HTMLElement): void {
  // 给含卡片的 blockquote 添加标记类（用于 CSS 降低其蓝色边框优先级）
  container.querySelectorAll('.lt-link-card').forEach(card => {
    const blockquote = card.closest('blockquote')
    if (blockquote) blockquote.classList.add('lt-has-link-card')
  })

  // 文章卡片点击
  container.querySelectorAll<HTMLElement>('.lt-link-card--article:not([data-bound])').forEach(card => {
    card.setAttribute('data-bound', '1')
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url')
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    })
  })

  // 视频卡片点击 - 展开嵌入式播放器（可收起）
  container.querySelectorAll<HTMLElement>('.lt-link-card--video:not([data-bound])').forEach(card => {
    card.setAttribute('data-bound', '1')
    card.addEventListener('click', () => {
      if (card.classList.contains('lt-link-card--video-expanded')) return

      const embedUrl = card.getAttribute('data-embed-url')
      if (!embedUrl) {
        // 不支持嵌入播放的平台（如 icourse163），直接打开新窗口
        const directUrl = card.getAttribute('data-url')
        if (directUrl) window.open(directUrl, '_blank', 'noopener,noreferrer')
        return
      }

      const thumb = card.querySelector<HTMLElement>('.lt-link-card__thumb')
      if (!thumb) return

      // 保存原始缩略图 HTML（用于收起时恢复）
      const originalThumbHtml = thumb.innerHTML

      // 替换缩略图为 iframe 播放器
      thumb.innerHTML = `<iframe src="${escapeAttr(embedUrl)}" frameborder="0" allowfullscreen style="width:100%;height:100%;border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe>`
      card.classList.add('lt-link-card--video-expanded')

      // 添加收起按钮
      const closeBtn = document.createElement('button')
      closeBtn.className = 'lt-link-card__close-btn'
      closeBtn.innerHTML = '×'
      closeBtn.title = '收起视频'
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        thumb.innerHTML = originalThumbHtml
        card.classList.remove('lt-link-card--video-expanded')
        closeBtn.remove()
        // 重新绑定缩略图错误处理
        const restoredImg = thumb.querySelector<HTMLImageElement>('.lt-link-card__thumb-img')
        if (restoredImg) {
          restoredImg.addEventListener('error', () => {
            restoredImg.style.display = 'none'
            const fallback = restoredImg.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          })
          if (restoredImg.complete && restoredImg.naturalWidth === 0) {
            restoredImg.style.display = 'none'
            const fallback = restoredImg.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }
        }
      })
      card.appendChild(closeBtn)
    })
  })

  // favicon 加载失败 → 显示 fallback
  container.querySelectorAll<HTMLImageElement>('.lt-link-card__favicon-img:not([data-bound])').forEach(img => {
    img.setAttribute('data-bound', '1')
    img.addEventListener('error', () => {
      img.style.display = 'none'
      const fallback = img.nextElementSibling as HTMLElement | null
      if (fallback) fallback.style.display = 'flex'
    })
    // 如果已经加载失败（缓存场景）
    if (img.complete && img.naturalWidth === 0) {
      img.style.display = 'none'
      const fallback = img.nextElementSibling as HTMLElement | null
      if (fallback) fallback.style.display = 'flex'
    }
  })

  // 视频缩略图加载失败 → 显示 fallback
  container.querySelectorAll<HTMLImageElement>('.lt-link-card__thumb-img:not([data-bound])').forEach(img => {
    img.setAttribute('data-bound', '1')
    img.addEventListener('error', () => {
      img.style.display = 'none'
      const fallback = img.nextElementSibling as HTMLElement | null
      if (fallback) fallback.style.display = 'flex'
    })
    if (img.complete && img.naturalWidth === 0) {
      img.style.display = 'none'
      const fallback = img.nextElementSibling as HTMLElement | null
      if (fallback) fallback.style.display = 'flex'
    }
  })

  // 视频元数据抓取：B站 JSONP 获取标题+封面，YouTube oEmbed 获取标题
  container.querySelectorAll<HTMLElement>('.lt-link-card--video:not([data-meta-fetched])').forEach(card => {
    card.setAttribute('data-meta-fetched', '1')
    const platform = card.getAttribute('data-platform')
    const videoId = card.getAttribute('data-video-id')
    if (!platform || !videoId) return

    const updateTitle = (title: string) => {
      if (!card.isConnected) return
      const titleEl = card.querySelector<HTMLElement>('.lt-link-card__video-title')
      if (titleEl) titleEl.textContent = title
    }

    const updateThumbnail = (picUrl: string) => {
      if (!card.isConnected) return
      const thumb = card.querySelector<HTMLElement>('.lt-link-card__thumb')
      const placeholder = thumb?.querySelector<HTMLElement>('.lt-link-card__thumb-placeholder')
      if (!thumb || !placeholder) return
      // 强制 https 避免混合内容阻止（B站 CDN 支持 HTTPS）
      const secureUrl = picUrl.replace(/^http:\/\//, 'https://')
      const img = document.createElement('img')
      img.src = secureUrl.startsWith('http') ? secureUrl : `https:${secureUrl}`
      img.alt = ''
      // no-referrer 绕过 B站 CDN 防盗链（403 Forbidden）
      img.referrerPolicy = 'no-referrer'
      img.className = 'lt-link-card__thumb-img'
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:transform 0.5s cubic-bezier(0.2,0.8,0.2,1);'
      img.addEventListener('error', () => {
        img.style.display = 'none'
        placeholder.style.display = 'flex'
      })
      placeholder.style.display = 'none'
      thumb.insertBefore(img, placeholder)
    }

    if (platform === 'bilibili') {
      fetchBilibiliInfo(videoId).then(({ title, pic }) => {
        updateTitle(title)
        updateThumbnail(pic)
      }).catch(() => { /* 静默失败，保持占位 */ })
    } else if (platform === 'youtube') {
      fetchYouTubeInfo(videoId).then(({ title }) => {
        updateTitle(title)
      }).catch(() => { /* 静默失败 */ })
    } else if (platform === 'icourse163') {
      fetchIcourse163Info(videoId).then(({ title, pic }) => {
        updateTitle(title)
        if (pic) updateThumbnail(pic)
      }).catch(() => { /* 静默失败 */ })
    } else if (platform === 'xuetangx') {
      fetchXuetangxInfo(videoId).then(({ title, pic }) => {
        updateTitle(title)
        if (pic) updateThumbnail(pic)
      }).catch(() => { /* 静默失败 */ })
    }
  })
}
