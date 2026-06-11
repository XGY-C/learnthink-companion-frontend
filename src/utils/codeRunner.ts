import { apiFetch } from '@/utils/api'
import type { CodeRunRequest, CodeRunResult } from '@/types'

export async function runCode(req: CodeRunRequest): Promise<CodeRunResult> {
  const res = await apiFetch<CodeRunResult>('/code/run', {
    method: 'POST',
    body: req,
  })
  return res.data
}
