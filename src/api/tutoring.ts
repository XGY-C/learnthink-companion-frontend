import { apiFetch, ensureValidToken } from '@/utils/api'
import type {
  TutoringStartRequest,
  RegenerateSectionRequest,
  TutoringSessionSummary,
  TutoringSessionDetail,
  TutoringFeedback,
} from '@/types/tutoring'
import type { ApiResult } from '@/utils/api'

function getToken(): string {
  return localStorage.getItem('token') || ''
}

export { ensureValidToken, getToken }

// ========== SSE 流式答疑 ==========

export async function startTutoringStream(
  request: TutoringStartRequest
): Promise<Response> {
  await ensureValidToken()
  return fetch('/api/tutoring/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  })
}

export async function regenerateSection(
  sessionId: string,
  request: RegenerateSectionRequest
): Promise<Response> {
  await ensureValidToken()
  return fetch(`/api/tutoring/${sessionId}/regenerate-section`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  })
}

// ========== 历史会话 ==========

export async function getTutoringSessions(
  page: number,
  courseId?: string
): Promise<ApiResult<{ records: TutoringSessionSummary[]; total: number }>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (courseId) params.set('courseId', courseId)
  return apiFetch(`/tutoring/sessions?${params.toString()}`)
}

export async function getTutoringSessionDetail(
  sessionId: string
): Promise<ApiResult<TutoringSessionDetail>> {
  return apiFetch(`/tutoring/${sessionId}/history`)
}

// ========== 反馈 ==========

export async function submitTutoringFeedback(
  sessionId: string,
  feedback: TutoringFeedback
): Promise<ApiResult<void>> {
  return apiFetch(`/tutoring/${sessionId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(feedback),
  })
}

// ========== 图解重试 ==========

export async function retryDiagram(
  sessionId: string,
  diagramId: string
): Promise<ApiResult<void>> {
  return apiFetch(`/tutoring/${sessionId}/diagram/retry`, {
    method: 'POST',
    body: JSON.stringify({ diagramId }),
  })
}
