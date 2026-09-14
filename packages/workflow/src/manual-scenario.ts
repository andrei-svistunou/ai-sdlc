import {
  ApprovalMismatchError,
  LimitExceededError,
  createWorkflowDefinition,
  createWorkflowRun,
} from '@ai-sdlc/domain';
import type {
  ArtifactKind,
  ArtifactReference,
  WorkflowDefinition,
  WorkflowRun,
} from '@ai-sdlc/domain';

import { WorkflowEngine } from './engine.js';

const now = '2026-09-14T12:00:00.000Z';

let nextId = 0;
const idFactory = (): string => `scenario-${++nextId}`;

function createArtifact(
  runId: string,
  id: string,
  kind: ArtifactKind,
  logicalName: string,
  version: number,
): ArtifactReference {
  return {
    id,
    runId,
    logicalName,
    version,
    kind,
    contentType: kind === 'verification' ? 'application/json' : 'text/markdown',
    sha256: `${id}-sha256`,
    byteSize: 100,
    createdAt: now,
  };
}

function expectError(action: () => void, expected: new (...args: never[]) => Error): void {
  try {
    action();
  } catch (error) {
    if (error instanceof expected) {
      return;
    }

    throw error;
  }

  throw new Error(`Expected ${expected.name} to be thrown.`);
}

function createGoldenPathDefinition(): WorkflowDefinition {
  return createWorkflowDefinition({
    id: 'feature-development',
    version: 1,
    maxPlanRevisions: 3,
    maxReviewIterations: 1,
    steps: [
      { id: 'analyze', phase: 'analysis', type: 'agent', role: 'analyst' },
      { id: 'plan', phase: 'planning', type: 'agent', role: 'architect' },
      { id: 'approve-plan', phase: 'planning', type: 'approval', approvalType: 'plan' },
      { id: 'implement', phase: 'implementation', type: 'agent', role: 'developer' },
      {
        id: 'verify',
        phase: 'verification',
        type: 'command-set',
        retry: { maxAttempts: 2, strategy: 'agent-fix' },
      },
      { id: 'review', phase: 'review', type: 'agent', role: 'reviewer' },
      {
        id: 'fix-review',
        phase: 'implementation',
        type: 'agent',
        role: 'developer',
        when: 'review.changesRequired',
        loopTo: 'verify',
        maxIterations: 1,
      },
      { id: 'ready', phase: 'finalization', type: 'terminal' },
    ],
  });
}

function runGoldenPath(): WorkflowRun {
  const definition = createGoldenPathDefinition();
  const engine = new WorkflowEngine(definition, { idFactory });
  const runId = 'run-golden-path';
  const planV1 = createArtifact(runId, 'plan-v1', 'plan', 'plan-v1', 1);
  const planV2 = createArtifact(runId, 'plan-v2', 'plan', 'plan-v1', 2);
  let run = createWorkflowRun({ id: runId, taskId: 'task-001', definition, now });

  run = engine.start(run, now).state;
  run = engine.completeStep(
    run,
    {
      stepId: 'analyze',
      artifacts: [createArtifact(runId, 'analysis-v1', 'analysis', 'analysis-v1', 1)],
    },
    now,
  ).state;
  run = engine.completeStep(run, { stepId: 'plan', artifacts: [planV1] }, now).state;
  run = engine.rejectPlan(run, 'Clarify the rollback strategy.', now).state;
  run = engine.completeStep(run, { stepId: 'plan', artifacts: [planV2] }, now).state;

  if (!run.approvals.some((approval) => approval.status === 'superseded')) {
    throw new Error('The first plan approval was not superseded by the changed plan.');
  }

  expectError(() => engine.approvePlan(run, planV1, now), ApprovalMismatchError);
  run = engine.approvePlan(run, planV2, now).state;
  run = engine.completeStep(
    run,
    {
      stepId: 'implement',
      artifacts: [createArtifact(runId, 'implementation-v1', 'implementation', 'summary-v1', 1)],
    },
    now,
  ).state;
  run = engine.failStep(run, 'lint failed', now).state;
  run = engine.retryStep(run, now).state;
  run = engine.completeStep(
    run,
    {
      stepId: 'verify',
      artifacts: [createArtifact(runId, 'verification-v1', 'verification', 'verification-v1', 1)],
    },
    now,
  ).state;
  run = engine.completeStep(
    run,
    {
      stepId: 'review',
      artifacts: [createArtifact(runId, 'review-v1', 'review', 'review-v1', 1)],
      changesRequired: false,
    },
    now,
  ).state;

  if (run.status !== 'succeeded' || run.phase !== 'finalization') {
    throw new Error(`Golden path ended in ${run.status}/${run.phase}.`);
  }

  if (!run.approvals.some((approval) => approval.status === 'approved')) {
    throw new Error('The current plan approval was not accepted.');
  }

  return run;
}

function demonstrateRetryLimit(): void {
  const definition = createWorkflowDefinition({
    id: 'retry-limit',
    version: 1,
    steps: [
      {
        id: 'verify',
        phase: 'verification',
        type: 'command-set',
        retry: { maxAttempts: 1, strategy: 'retry' },
      },
    ],
  });
  const engine = new WorkflowEngine(definition, { idFactory });
  let run = createWorkflowRun({ id: 'run-retry-limit', taskId: 'task-001', definition, now });
  run = engine.start(run, now).state;
  run = engine.failStep(run, 'verification failed', now).state;
  expectError(() => engine.retryStep(run, now), LimitExceededError);
}

function demonstrateReviewLimit(): void {
  const definition = createWorkflowDefinition({
    id: 'review-limit',
    version: 1,
    maxReviewIterations: 1,
    steps: [
      { id: 'review', phase: 'review', type: 'agent', role: 'reviewer' },
      {
        id: 'fix-review',
        phase: 'implementation',
        type: 'agent',
        role: 'developer',
        when: 'review.changesRequired',
        loopTo: 'review',
        maxIterations: 1,
      },
    ],
  });
  const engine = new WorkflowEngine(definition, { idFactory });
  const runId = 'run-review-limit';
  let run = createWorkflowRun({ id: runId, taskId: 'task-001', definition, now });
  run = engine.start(run, now).state;
  run = engine.completeStep(
    run,
    {
      stepId: 'review',
      artifacts: [createArtifact(runId, 'review-limit-v1', 'review', 'review-v1', 1)],
      changesRequired: true,
    },
    now,
  ).state;
  run = engine.completeStep(run, { stepId: 'fix-review' }, now).state;
  expectError(
    () =>
      engine.completeStep(
        run,
        {
          stepId: 'review',
          changesRequired: true,
        },
        now,
      ),
    LimitExceededError,
  );
}

function main(): void {
  runGoldenPath();
  demonstrateRetryLimit();
  demonstrateReviewLimit();
  console.log(
    'TASK-002 manual scenario passed: golden path, approval superseding, and bounded loops.',
  );
}

main();
