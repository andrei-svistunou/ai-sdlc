import type {
  ApprovalId,
  ArtifactId,
  DecisionId,
  QuestionId,
  RunStatus,
  StepAttemptId,
  StepStatus,
  Timestamp,
  WorkflowPhase,
  WorkflowRunId,
  WorkflowStepId,
} from './types.js';

interface DomainEventBase {
  readonly eventId: string;
  readonly runId: WorkflowRunId;
  readonly occurredAt: Timestamp;
}

export type DomainEvent =
  | (DomainEventBase & {
      readonly type: 'run-started';
      readonly stepId: WorkflowStepId;
    })
  | (DomainEventBase & {
      readonly type: 'run-status-changed';
      readonly from: RunStatus;
      readonly to: RunStatus;
      readonly phase: WorkflowPhase;
    })
  | (DomainEventBase & {
      readonly type: 'step-attempt-started';
      readonly stepId: WorkflowStepId;
      readonly attemptId: StepAttemptId;
      readonly attemptNumber: number;
    })
  | (DomainEventBase & {
      readonly type: 'step-attempt-finished';
      readonly stepId: WorkflowStepId;
      readonly attemptId: StepAttemptId;
      readonly status: StepStatus;
      readonly artifactIds: readonly ArtifactId[];
    })
  | (DomainEventBase & {
      readonly type: 'step-skipped';
      readonly stepId: WorkflowStepId;
    })
  | (DomainEventBase & {
      readonly type: 'approval-requested';
      readonly approvalId: ApprovalId;
      readonly artifactId: ArtifactId;
    })
  | (DomainEventBase & {
      readonly type: 'approval-approved';
      readonly approvalId: ApprovalId;
      readonly artifactId: ArtifactId;
    })
  | (DomainEventBase & {
      readonly type: 'approval-rejected';
      readonly approvalId: ApprovalId;
      readonly comment: string;
    })
  | (DomainEventBase & {
      readonly type: 'approval-superseded';
      readonly approvalId: ApprovalId;
      readonly supersededByArtifactId: ArtifactId;
    })
  | (DomainEventBase & {
      readonly type: 'question-asked';
      readonly questionId: QuestionId;
      readonly stepId: WorkflowStepId;
    })
  | (DomainEventBase & {
      readonly type: 'question-answered';
      readonly questionId: QuestionId;
      readonly decisionId: DecisionId;
    })
  | (DomainEventBase & {
      readonly type: 'decision-recorded';
      readonly decisionId: DecisionId;
    })
  | (DomainEventBase & {
      readonly type: 'run-succeeded';
    })
  | (DomainEventBase & {
      readonly type: 'run-failed';
      readonly reason: string;
    })
  | (DomainEventBase & {
      readonly type: 'run-cancelled';
    });

export interface TransitionResult<T> {
  readonly state: T;
  readonly events: readonly DomainEvent[];
}
