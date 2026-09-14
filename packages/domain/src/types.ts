export type TaskId = string;
export type RepositoryId = string;
export type WorkflowDefinitionId = string;
export type WorkflowRunId = string;
export type WorkflowStepId = string;
export type StepAttemptId = string;
export type ArtifactId = string;
export type QuestionId = string;
export type DecisionId = string;
export type ApprovalId = string;
export type AgentSessionId = string;
export type Timestamp = string;

export type WorkflowPhase =
  | 'intake'
  | 'analysis'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'finalization';

export type RunStatus =
  | 'idle'
  | 'running'
  | 'interrupted'
  | 'waiting-for-input'
  | 'waiting-for-approval'
  | 'retry-pending'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'interrupted'
  | 'waiting-for-input'
  | 'waiting-for-approval'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type WorkflowStepType = 'agent' | 'approval' | 'command-set' | 'terminal';
export type AgentRole = 'analyst' | 'architect' | 'developer' | 'reviewer';
export type ApprovalType = 'plan' | 'implementation' | 'final';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
export type QuestionStatus = 'open' | 'answered';
export type DecisionKind = 'question-answer' | 'plan-rejection' | 'operator';
export type ArtifactKind =
  | 'request'
  | 'analysis'
  | 'plan'
  | 'implementation'
  | 'diff'
  | 'verification'
  | 'review'
  | 'decision'
  | 'summary';

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly strategy: 'retry' | 'agent-fix';
}

export interface WorkflowStep {
  readonly id: WorkflowStepId;
  readonly phase: WorkflowPhase;
  readonly type: WorkflowStepType;
  readonly role?: AgentRole;
  readonly skill?: string;
  readonly inputArtifactLogicalNames?: readonly string[];
  readonly outputArtifactLogicalName?: string;
  readonly approvalType?: ApprovalType;
  readonly retry?: RetryPolicy;
  readonly when?: string;
  readonly loopTo?: WorkflowStepId;
  readonly maxIterations?: number;
}

export interface WorkflowDefinition {
  readonly id: WorkflowDefinitionId;
  readonly version: number;
  readonly steps: readonly WorkflowStep[];
  readonly maxPlanRevisions?: number;
  readonly maxReviewIterations?: number;
}
