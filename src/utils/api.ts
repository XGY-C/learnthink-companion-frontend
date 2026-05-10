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

function getToken(): string {
  return localStorage.getItem('token') || ''
}

function handleUnauthorized() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userInfo')

  const redirect = encodeURIComponent(location.pathname + location.search)
  if (!location.pathname.startsWith('/login')) {
    location.href = `/login?redirect=${redirect}`
  }
}

/**
 * 统一 API 请求：
 * - 自动添加 Authorization: Bearer <token>
 * - 默认以 `/api` 为前缀（由 Vite proxy 转发到后端）
 * - 统一处理 401：清理登录态并跳转登录页
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', headers = {}, body, skipAuth = false, ...rest } = options

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...headers
  }

  if (!skipAuth) {
    const token = getToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...rest
  })

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
