import { InvalidInputError, InvariantViolationError } from './errors.js';
import type { Task, WorkflowRun } from './entities.js';
import type { TaskId, Timestamp, WorkflowDefinition, WorkflowRunId } from './types.js';

function requireText(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new InvalidInputError(`${label} must not be empty.`);
  }

  return normalized;
}

export interface CreateTaskInput {
  readonly id: TaskId;
  readonly title: string;
  readonly description: string;
  readonly repositoryId: string;
  readonly now: Timestamp;
}

export function createTask(input: CreateTaskInput): Task {
  return {
    id: requireText(input.id, 'Task id'),
    title: requireText(input.title, 'Task title'),
    description: input.description.trim(),
    repositoryId: requireText(input.repositoryId, 'Repository id'),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function createWorkflowDefinition(input: WorkflowDefinition): WorkflowDefinition {
  if (input.id.trim().length === 0) {
    throw new InvalidInputError('Workflow definition id must not be empty.');
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new InvalidInputError('Workflow definition version must be a positive integer.');
  }

  if (input.steps.length === 0) {
    throw new InvalidInputError('Workflow definition must contain at least one step.');
  }

  const stepIds = new Set<string>();

  for (const step of input.steps) {
    if (step.id.trim().length === 0 || stepIds.has(step.id)) {
      throw new InvalidInputError(`Workflow step id must be unique: ${step.id}.`);
    }

    stepIds.add(step.id);

    if (step.type === 'approval' && !step.approvalType) {
      throw new InvalidInputError(`Approval step ${step.id} must declare approvalType.`);
    }

    if (step.retry && (!Number.isInteger(step.retry.maxAttempts) || step.retry.maxAttempts < 1)) {
      throw new InvalidInputError(`Retry limit for step ${step.id} must be a positive integer.`);
    }

    if (
      step.maxIterations !== undefined &&
      (!Number.isInteger(step.maxIterations) || step.maxIterations < 1)
    ) {
      throw new InvalidInputError(
        `Iteration limit for step ${step.id} must be a positive integer.`,
      );
    }
  }

  for (const step of input.steps) {
    if (step.loopTo && !stepIds.has(step.loopTo)) {
      throw new InvariantViolationError(`Step ${step.id} loops to missing step ${step.loopTo}.`);
    }
  }

  return {
    ...input,
    id: input.id.trim(),
    steps: input.steps.map((step) => ({ ...step })),
  };
}

export interface CreateWorkflowRunInput {
  readonly id: WorkflowRunId;
  readonly taskId: TaskId;
  readonly definition: WorkflowDefinition;
  readonly now: Timestamp;
}

export function createWorkflowRun(input: CreateWorkflowRunInput): WorkflowRun {
  if (input.id.trim().length === 0 || input.taskId.trim().length === 0) {
    throw new InvalidInputError('Workflow run id and task id must not be empty.');
  }

  return {
    id: input.id,
    taskId: input.taskId,
    workflowDefinitionId: input.definition.id,
    workflowDefinitionVersion: input.definition.version,
    phase: 'intake',
    status: 'idle',
    currentStepId: null,
    activeAttemptId: null,
    attempts: [],
    artifacts: [],
    questions: [],
    decisions: [],
    approvals: [],
    planRevision: 0,
    verificationAttempts: 0,
    reviewIterations: 0,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
