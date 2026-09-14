import type {
  ApprovalId,
  ApprovalStatus,
  ApprovalType,
  ArtifactId,
  ArtifactKind,
  DecisionId,
  DecisionKind,
  QuestionId,
  QuestionStatus,
  RepositoryId,
  RunStatus,
  StepAttemptId,
  StepStatus,
  TaskId,
  Timestamp,
  WorkflowDefinitionId,
  WorkflowPhase,
  WorkflowRunId,
  WorkflowStepId,
} from './types.js';

export interface Task {
  readonly id: TaskId;
  readonly title: string;
  readonly description: string;
  readonly repositoryId: RepositoryId;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface ArtifactReference {
  readonly id: ArtifactId;
  readonly runId: WorkflowRunId;
  readonly logicalName: string;
  readonly version: number;
  readonly kind: ArtifactKind;
  readonly contentType: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly createdAt: Timestamp;
}

export interface StepAttempt {
  readonly id: StepAttemptId;
  readonly runId: WorkflowRunId;
  readonly stepId: WorkflowStepId;
  readonly attemptNumber: number;
  readonly status: StepStatus;
  readonly inputArtifactRefs: readonly ArtifactReference[];
  readonly outputArtifactRefs: readonly ArtifactReference[];
  readonly startedAt: Timestamp;
  readonly finishedAt?: Timestamp;
  readonly error?: string;
}

export interface Question {
  readonly id: QuestionId;
  readonly runId: WorkflowRunId;
  readonly stepId: WorkflowStepId;
  readonly attemptId: StepAttemptId;
  readonly prompt: string;
  readonly status: QuestionStatus;
  readonly answer?: string;
  readonly decisionId?: DecisionId;
  readonly askedAt: Timestamp;
  readonly answeredAt?: Timestamp;
}

export interface Decision {
  readonly id: DecisionId;
  readonly runId: WorkflowRunId;
  readonly kind: DecisionKind;
  readonly body: string;
  readonly questionId?: QuestionId;
  readonly approvalId?: ApprovalId;
  readonly createdAt: Timestamp;
}

export interface Approval {
  readonly id: ApprovalId;
  readonly runId: WorkflowRunId;
  readonly approvalType: ApprovalType;
  readonly artifactRef: ArtifactReference;
  readonly status: ApprovalStatus;
  readonly comment?: string;
  readonly createdAt: Timestamp;
  readonly decidedAt?: Timestamp;
}

export interface WorkflowRun {
  readonly id: WorkflowRunId;
  readonly taskId: TaskId;
  readonly workflowDefinitionId: WorkflowDefinitionId;
  readonly workflowDefinitionVersion: number;
  readonly phase: WorkflowPhase;
  readonly status: RunStatus;
  readonly currentStepId: WorkflowStepId | null;
  readonly activeAttemptId: StepAttemptId | null;
  readonly attempts: readonly StepAttempt[];
  readonly artifacts: readonly ArtifactReference[];
  readonly questions: readonly Question[];
  readonly decisions: readonly Decision[];
  readonly approvals: readonly Approval[];
  readonly planRevision: number;
  readonly verificationAttempts: number;
  readonly reviewIterations: number;
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
