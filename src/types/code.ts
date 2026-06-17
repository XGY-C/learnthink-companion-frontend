export interface CodeLineRef {
  filename: string
  startLine: number
  endLine: number
}

export interface CodeFile {
  filename: string
  content: string
  isEntry?: boolean
}

export interface CodeStep {
  title: string
  content: string
  references: CodeLineRef[]
}

export interface LearningGoal {
  id: string
  description: string
  relatedSteps: number[]
}

export interface KnowledgePoint {
  name: string
  category: 'variable' | 'loop' | 'function' | 'class' | 'exception' | 'builtin'
  references: CodeLineRef[]
  definition?: string
  complexity?: string
  commonMistakes?: string[]
}

export interface GuidedBlank {
  stepIndex: number
  filename: string
  line: number
  placeholder: string
  answer: string
  hints: string[]
}

export interface TestCase {
  name: string
  input: string
  expectedOutput: string
  isHidden?: boolean
}

export interface StepHint {
  stepIndex: number
  level: number
  content: string
  codeSnippet?: string
}

export interface FoldableRegion {
  startLine: number
  endLine: number
  title: string
  description: string
  autoFold: boolean
}

export interface TraceStep {
  order: number
  line: number
  scope: Record<string, any>
  output?: string
  error?: string
}

export interface ExecutionTrace {
  steps: TraceStep[]
  totalDuration: number
  peakMemory: number
}

export interface VariableInfo {
  name: string
  type: string
  scope: string
  definitionLine: number
  definition: string
  references: { line: number; text: string; kind: 'read' | 'write' }[]
  initialValue?: string
  finalValue?: string
}

export type LearningMode = 'read' | 'guide' | 'edit'

export type ContextTab = 'steps' | 'variables' | 'trajectory' | 'concepts' | 'tutor'

export interface CodeContentExtended {
  title: string
  language: string
  description: string
  files: CodeFile[]
  steps: CodeStep[]
  expectedOutput?: string
  extensionIdeas: string[]
  learningGoals?: LearningGoal[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes?: number
  knowledgePoints?: KnowledgePoint[]
  guidedBlanks?: GuidedBlank[]
  testCases?: TestCase[]
  hints?: StepHint[]
  foldableRegions?: FoldableRegion[]
}
