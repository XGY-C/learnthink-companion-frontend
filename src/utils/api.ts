export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'method' | 'headers'> {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: unknown
  skipAuth?: boolean
}

export class ApiError extends Error {
  status: number
  code?: number

  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// ===================================================================
//  Token 工具
// ===================================================================

function getToken(): string {
  return localStorage.getItem('token') || ''
}

function getRefreshToken(): string {
  return localStorage.getItem('refreshToken') || ''
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('token', accessToken)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
}

function decodeJwt(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

/** 检查 token 是否在 seconds 秒内过期 */
function isTokenExpiringSoon(token: string, seconds = 60): boolean {
  const decoded = decodeJwt(token)
  if (!decoded?.exp) return false
  return (decoded.exp * 1000) < (Date.now() + seconds * 1000)
}

// ===================================================================
//  刷新锁：防止并发刷新
// ===================================================================

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return false

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
    if (!res.ok) return false
    const result = await res.json()
    if (result.code === 0 || result.code === 200) {
      const { accessToken, refreshToken: newRt } = result.data
      setTokens(accessToken, newRt || rt)
      return true
    }
    return false
  } catch {
    return false
  }
}

/** 确保 token 有效：即将过期则刷新（供外部调用） */
export async function ensureValidToken(): Promise<boolean> {
  const token = getToken()
  if (!token) return false

  if (isTokenExpiringSoon(token, 60)) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    return refreshPromise
  }
  return true
}

// ===================================================================
//  401 兜底：刷新失败才跳登录
// ===================================================================

function handleUnauthorized() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userInfo')

  const redirect = encodeURIComponent(location.pathname + location.search)
  if (!location.pathname.startsWith('/login')) {
    location.href = `/login?redirect=${redirect}`
  }
}

// ===================================================================
//  统一 API 请求
// ===================================================================

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', headers = {}, body, skipAuth = false, ...rest } = options

  // 预刷新：token 临近过期时自动续期
  if (!skipAuth) {
    await ensureValidToken()
  }

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...headers,
    }
    if (!skipAuth) {
      const token = getToken()
      if (token) h.Authorization = `Bearer ${token}`
    }
    return h
  }

  const doFetch = () =>
    fetch(`/api${path}`, {
      method,
      headers: buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      ...rest,
    })

  let res = await doFetch()

  // 401：尝试刷新 token 后重试一次
  if (res.status === 401 && !skipAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const refreshed = await refreshPromise
    if (refreshed) {
      res = await doFetch()
    }
  }

  // 重试后仍 401 → 跳登录
  if (res.status === 401) {
    handleUnauthorized()
    throw new ApiError('未登录或登录已过期', 401)
  }

  let payload: any
  try {
    payload = await res.json()
  } catch {
    payload = undefined
  }

  if (!res.ok) {
    const message = payload?.message || `请求失败（HTTP ${res.status}）`
    throw new ApiError(message, res.status, payload?.code)
  }

  return payload as ApiResult<T>
}
