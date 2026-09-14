import {
  ApprovalMismatchError,
  InvalidInputError,
  InvalidTransitionError,
  LimitExceededError,
  NotFoundError,
} from '@ai-sdlc/domain';
import type {
  Approval,
  ArtifactReference,
  Decision,
  DomainEvent,
  Question,
  StepAttempt,
  StepStatus,
  TransitionResult,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
} from '@ai-sdlc/domain';

export type IdFactory = () => string;

export interface WorkflowEngineOptions {
  readonly idFactory: IdFactory;
  readonly maxPlanRevisions?: number;
  readonly maxReviewIterations?: number;
}

export interface CompleteStepInput {
  readonly stepId: string;
  readonly artifacts?: readonly ArtifactReference[];
  readonly changesRequired?: boolean;
}

const DEFAULT_MAX_PLAN_REVISIONS = 3;
const DEFAULT_MAX_REVIEW_ITERATIONS = 3;

export class WorkflowEngine {
  private readonly definition: WorkflowDefinition;
  private readonly idFactory: IdFactory;
  private readonly maxPlanRevisions: number;
  private readonly maxReviewIterations: number;

  public constructor(definition: WorkflowDefinition, options: WorkflowEngineOptions) {
    this.definition = definition;
    this.idFactory = options.idFactory;
    this.maxPlanRevisions =
      options.maxPlanRevisions ?? definition.maxPlanRevisions ?? DEFAULT_MAX_PLAN_REVISIONS;
    this.maxReviewIterations =
      options.maxReviewIterations ??
      definition.maxReviewIterations ??
      DEFAULT_MAX_REVIEW_ITERATIONS;

    if (!Number.isInteger(this.maxPlanRevisions) || this.maxPlanRevisions < 1) {
      throw new InvalidInputError('Maximum plan revisions must be a positive integer.');
    }

    if (!Number.isInteger(this.maxReviewIterations) || this.maxReviewIterations < 1) {
      throw new InvalidInputError('Maximum review iterations must be a positive integer.');
    }
  }

  public start(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);

    if (run.status !== 'idle') {
      throw new InvalidTransitionError(`Run ${run.id} cannot start from status ${run.status}.`);
    }

    const firstStep = this.definition.steps[0];
    if (!firstStep) {
      throw new InvalidTransitionError('A workflow definition must contain a start step.');
    }

    const events: DomainEvent[] = [
      this.event(run, now, { type: 'run-started', stepId: firstStep.id }),
    ];
    const state = this.startStep(run, firstStep, now, events);

    return this.result(state, events, now);
  }

  public completeStep(
    run: WorkflowRun,
    input: CompleteStepInput,
    now: string,
  ): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    this.assertRunning(run);

    const step = this.requireCurrentStep(run, input.stepId);
    if (step.type === 'approval' || step.type === 'terminal') {
      throw new InvalidTransitionError(
        `Step ${step.id} must be completed through its dedicated transition.`,
      );
    }

    const activeAttempt = this.requireActiveAttempt(run, step.id);
    const artifacts = input.artifacts ?? [];
    this.validateArtifacts(run, artifacts);

    const events: DomainEvent[] = [];
    let state = this.finishAttempt(
      run,
      activeAttempt,
      'succeeded',
      now,
      artifacts,
      undefined,
      events,
    );
    state = this.appendArtifacts(state, artifacts);

    return this.advanceAfterStep(state, step, input, now, events);
  }

  public approvePlan(
    run: WorkflowRun,
    artifactRef: ArtifactReference,
    now: string,
  ): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);

    if (run.status !== 'waiting-for-approval') {
      throw new InvalidTransitionError(`Run ${run.id} is not waiting for approval.`);
    }

    const approvalStep = this.requireCurrentStep(run);
    if (approvalStep.type !== 'approval' || approvalStep.approvalType !== 'plan') {
      throw new InvalidTransitionError(`Run ${run.id} is not waiting for plan approval.`);
    }

    const approval = this.requirePendingApproval(run, 'plan');
    if (!sameArtifact(approval.artifactRef, artifactRef)) {
      throw new ApprovalMismatchError(
        `Approval ${approval.id} is bound to artifact ${approval.artifactRef.logicalName}@${approval.artifactRef.version}.`,
      );
    }

    const events: DomainEvent[] = [
      this.event(run, now, {
        type: 'approval-approved',
        approvalId: approval.id,
        artifactId: artifactRef.id,
      }),
    ];
    const approvals = run.approvals.map((candidate) =>
      candidate.id === approval.id
        ? { ...candidate, status: 'approved' as const, decidedAt: now }
        : candidate,
    );
    const state = { ...run, approvals };

    return this.advanceAfterStep(state, approvalStep, { stepId: approvalStep.id }, now, events);
  }

  public rejectPlan(run: WorkflowRun, comment: string, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);

    if (run.status !== 'waiting-for-approval') {
      throw new InvalidTransitionError(`Run ${run.id} is not waiting for approval.`);
    }

    const approvalStep = this.requireCurrentStep(run);
    if (approvalStep.type !== 'approval' || approvalStep.approvalType !== 'plan') {
      throw new InvalidTransitionError(`Run ${run.id} is not waiting for plan approval.`);
    }

    const normalizedComment = comment.trim();
    if (normalizedComment.length === 0) {
      throw new InvalidInputError('Rejecting a plan requires a comment.');
    }

    const approval = this.requirePendingApproval(run, 'plan');
    const planStep = this.definition.steps.find(
      (candidate) => candidate.phase === 'planning' && candidate.type === 'agent',
    );
    if (!planStep) {
      throw new InvalidTransitionError('The workflow does not define a planning step.');
    }

    const decision: Decision = {
      id: this.idFactory(),
      runId: run.id,
      kind: 'plan-rejection',
      body: normalizedComment,
      approvalId: approval.id,
      createdAt: now,
    };
    const attempt = this.createAttempt(run, planStep, now, []);
    const events: DomainEvent[] = [
      this.event(run, now, {
        type: 'approval-rejected',
        approvalId: approval.id,
        comment: normalizedComment,
      }),
      this.event(run, now, { type: 'decision-recorded', decisionId: decision.id }),
      this.event(run, now, {
        type: 'step-attempt-started',
        stepId: planStep.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
      }),
    ];
    const state: WorkflowRun = {
      ...run,
      status: 'running',
      phase: planStep.phase,
      currentStepId: planStep.id,
      activeAttemptId: attempt.id,
      attempts: [...run.attempts, attempt],
      decisions: [...run.decisions, decision],
      approvals: run.approvals.map((candidate) =>
        candidate.id === approval.id
          ? {
              ...candidate,
              status: 'rejected' as const,
              comment: normalizedComment,
              decidedAt: now,
            }
          : candidate,
      ),
    };

    return this.result(state, events, now);
  }

  public failStep(run: WorkflowRun, reason: string, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    this.assertRunning(run);

    const step = this.requireCurrentStep(run);
    const attempt = this.requireActiveAttempt(run, step.id);
    const normalizedReason = reason.trim();
    if (normalizedReason.length === 0) {
      throw new InvalidInputError('A failed step requires a reason.');
    }

    const events: DomainEvent[] = [];
    const finished = this.finishAttempt(run, attempt, 'failed', now, [], normalizedReason, events);
    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const canRetry = attempt.attemptNumber < maxAttempts;
    const nextStatus = canRetry ? 'retry-pending' : 'failed';
    const state: WorkflowRun = {
      ...finished,
      status: nextStatus,
      activeAttemptId: null,
      verificationAttempts:
        step.phase === 'verification' ? run.verificationAttempts + 1 : run.verificationAttempts,
    };

    this.addStatusEvent(run, state, now, events);
    if (!canRetry) {
      events.push(this.event(run, now, { type: 'run-failed', reason: normalizedReason }));
    }

    return this.result(state, events, now);
  }

  public interrupt(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    this.assertRunning(run);

    const step = this.requireCurrentStep(run);
    const attempt = this.requireActiveAttempt(run, step.id);
    const events: DomainEvent[] = [];
    const finished = this.finishAttempt(run, attempt, 'interrupted', now, [], undefined, events);
    const state: WorkflowRun = { ...finished, status: 'interrupted', activeAttemptId: null };
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  public retryStep(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);

    if (run.status !== 'retry-pending' && run.status !== 'interrupted' && run.status !== 'failed') {
      throw new InvalidTransitionError(`Run ${run.id} cannot retry from status ${run.status}.`);
    }

    const step = this.requireCurrentStep(run);
    const previousAttempt = this.latestAttempt(run, step.id);
    if (!previousAttempt) {
      throw new InvalidTransitionError(`Step ${step.id} has no attempt to retry.`);
    }

    const maxAttempts = step.retry?.maxAttempts ?? 1;
    if (previousAttempt.attemptNumber >= maxAttempts) {
      throw new LimitExceededError(
        `Step ${step.id} has reached its maximum of ${maxAttempts} attempts.`,
      );
    }

    const events: DomainEvent[] = [];
    const attempt = this.createAttempt(run, step, now, previousAttempt.inputArtifactRefs);
    const state: WorkflowRun = {
      ...run,
      status: 'running',
      phase: step.phase,
      activeAttemptId: attempt.id,
      attempts: [...run.attempts, attempt],
    };
    this.addStatusEvent(run, state, now, events);
    events.push(
      this.event(run, now, {
        type: 'step-attempt-started',
        stepId: step.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
      }),
    );

    return this.result(state, events, now);
  }

  public askQuestion(run: WorkflowRun, prompt: string, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    this.assertRunning(run);

    const step = this.requireCurrentStep(run);
    const attempt = this.requireActiveAttempt(run, step.id);
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length === 0) {
      throw new InvalidInputError('A question requires a prompt.');
    }

    const question: Question = {
      id: this.idFactory(),
      runId: run.id,
      stepId: step.id,
      attemptId: attempt.id,
      prompt: normalizedPrompt,
      status: 'open',
      askedAt: now,
    };
    const attempts = run.attempts.map((candidate) =>
      candidate.id === attempt.id
        ? { ...candidate, status: 'waiting-for-input' as const }
        : candidate,
    );
    const state: WorkflowRun = {
      ...run,
      status: 'waiting-for-input',
      activeAttemptId: null,
      attempts,
      questions: [...run.questions, question],
    };
    const events: DomainEvent[] = [
      this.event(run, now, { type: 'question-asked', questionId: question.id, stepId: step.id }),
    ];
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  public answerQuestion(
    run: WorkflowRun,
    questionId: string,
    answer: string,
    now: string,
  ): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);

    if (run.status !== 'waiting-for-input') {
      throw new InvalidTransitionError(`Run ${run.id} is not waiting for input.`);
    }

    const question = run.questions.find((candidate) => candidate.id === questionId);
    if (!question || question.status !== 'open') {
      throw new NotFoundError(`Open question ${questionId} was not found on run ${run.id}.`);
    }

    const normalizedAnswer = answer.trim();
    if (normalizedAnswer.length === 0) {
      throw new InvalidInputError('An answer requires text.');
    }

    const decision: Decision = {
      id: this.idFactory(),
      runId: run.id,
      kind: 'question-answer',
      body: normalizedAnswer,
      questionId: question.id,
      createdAt: now,
    };
    const step = this.requireStep(question.stepId);
    const attempt = this.createAttempt(run, step, now, []);
    const state: WorkflowRun = {
      ...run,
      status: 'running',
      phase: step.phase,
      activeAttemptId: attempt.id,
      attempts: [...run.attempts, attempt],
      decisions: [...run.decisions, decision],
      questions: run.questions.map((candidate) =>
        candidate.id === question.id
          ? {
              ...candidate,
              status: 'answered' as const,
              answer: normalizedAnswer,
              decisionId: decision.id,
              answeredAt: now,
            }
          : candidate,
      ),
    };
    const events: DomainEvent[] = [
      this.event(run, now, {
        type: 'question-answered',
        questionId: question.id,
        decisionId: decision.id,
      }),
      this.event(run, now, { type: 'decision-recorded', decisionId: decision.id }),
      this.event(run, now, {
        type: 'step-attempt-started',
        stepId: step.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
      }),
    ];
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  public pause(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    if (run.status !== 'running') {
      throw new InvalidTransitionError(`Run ${run.id} cannot pause from status ${run.status}.`);
    }

    const state: WorkflowRun = { ...run, status: 'paused' };
    const events: DomainEvent[] = [];
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  public resume(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    if (run.status !== 'paused') {
      throw new InvalidTransitionError(`Run ${run.id} cannot resume from status ${run.status}.`);
    }

    const state: WorkflowRun = { ...run, status: 'running' };
    const events: DomainEvent[] = [];
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  public cancel(run: WorkflowRun, now: string): TransitionResult<WorkflowRun> {
    this.assertDefinition(run);
    if (run.status === 'succeeded' || run.status === 'cancelled') {
      throw new InvalidTransitionError(`Run ${run.id} is already terminal.`);
    }

    const events: DomainEvent[] = [];
    let state = run;
    if (run.activeAttemptId) {
      const attempt = this.requireActiveAttempt(run, run.currentStepId ?? undefined);
      state = this.finishAttempt(run, attempt, 'cancelled', now, [], undefined, events);
    }
    state = { ...state, status: 'cancelled', activeAttemptId: null };
    this.addStatusEvent(run, state, now, events);
    events.push(this.event(run, now, { type: 'run-cancelled' }));

    return this.result(state, events, now);
  }

  private advanceAfterStep(
    run: WorkflowRun,
    step: WorkflowStep,
    input: CompleteStepInput,
    now: string,
    events: DomainEvent[],
  ): TransitionResult<WorkflowRun> {
    if (step.loopTo) {
      const target = this.requireStep(step.loopTo);
      return this.finishOrStart(run, target, input, now, events);
    }

    const index = this.definition.steps.findIndex((candidate) => candidate.id === step.id);
    return this.advanceFromIndex(run, index + 1, input, now, events);
  }

  private advanceFromIndex(
    run: WorkflowRun,
    index: number,
    input: CompleteStepInput,
    now: string,
    events: DomainEvent[],
  ): TransitionResult<WorkflowRun> {
    for (let nextIndex = index; nextIndex < this.definition.steps.length; nextIndex += 1) {
      const next = this.definition.steps[nextIndex];
      if (!next) {
        break;
      }

      if (next.when === 'review.changesRequired' && input.changesRequired !== true) {
        events.push(this.event(run, now, { type: 'step-skipped', stepId: next.id }));
        continue;
      }

      if (next.when === 'review.changesRequired') {
        const maxIterations = next.maxIterations ?? this.maxReviewIterations;
        if (run.reviewIterations >= maxIterations) {
          throw new LimitExceededError(
            `Review fix loop has reached its maximum of ${maxIterations} iterations.`,
          );
        }

        run = { ...run, reviewIterations: run.reviewIterations + 1 };
      }

      return this.finishOrStart(run, next, input, now, events);
    }

    return this.finishRun(run, now, events);
  }

  private finishOrStart(
    run: WorkflowRun,
    next: WorkflowStep,
    input: CompleteStepInput,
    now: string,
    events: DomainEvent[],
  ): TransitionResult<WorkflowRun> {
    if (next.type === 'terminal') {
      return this.finishRun({ ...run, currentStepId: next.id, phase: next.phase }, now, events);
    }

    if (next.type === 'approval') {
      return this.requestApproval(run, next, input.artifacts ?? [], now, events);
    }

    const state = this.startStep(run, next, now, events);
    return this.result(state, events, now);
  }

  private requestApproval(
    run: WorkflowRun,
    step: WorkflowStep,
    artifacts: readonly ArtifactReference[],
    now: string,
    events: DomainEvent[],
  ): TransitionResult<WorkflowRun> {
    if (!step.approvalType) {
      throw new InvalidTransitionError(
        `Approval step ${step.id} does not declare an approval type.`,
      );
    }

    const artifactRef =
      step.approvalType === 'plan'
        ? artifacts.find((artifact) => artifact.kind === 'plan')
        : artifacts.at(-1);
    if (!artifactRef) {
      throw new InvalidTransitionError(`Approval step ${step.id} requires an artifact reference.`);
    }

    const nextPlanRevision = step.approvalType === 'plan' ? run.planRevision + 1 : run.planRevision;
    if (nextPlanRevision > this.maxPlanRevisions) {
      throw new LimitExceededError(
        `Plan revisions have reached their maximum of ${this.maxPlanRevisions}.`,
      );
    }

    const approvals: Approval[] = [];
    for (const approval of run.approvals) {
      if (
        approval.approvalType === step.approvalType &&
        approval.status !== 'superseded' &&
        !sameArtifact(approval.artifactRef, artifactRef)
      ) {
        approvals.push({ ...approval, status: 'superseded', decidedAt: now });
        events.push(
          this.event(run, now, {
            type: 'approval-superseded',
            approvalId: approval.id,
            supersededByArtifactId: artifactRef.id,
          }),
        );
      } else {
        approvals.push(approval);
      }
    }

    const approval: Approval = {
      id: this.idFactory(),
      runId: run.id,
      approvalType: step.approvalType,
      artifactRef,
      status: 'pending',
      createdAt: now,
    };
    const state: WorkflowRun = {
      ...run,
      status: 'waiting-for-approval',
      phase: step.phase,
      currentStepId: step.id,
      activeAttemptId: null,
      approvals: [...approvals, approval],
      planRevision: nextPlanRevision,
    };
    events.push(
      this.event(run, now, {
        type: 'approval-requested',
        approvalId: approval.id,
        artifactId: artifactRef.id,
      }),
    );
    this.addStatusEvent(run, state, now, events);

    return this.result(state, events, now);
  }

  private startStep(
    run: WorkflowRun,
    step: WorkflowStep,
    now: string,
    events: DomainEvent[],
  ): WorkflowRun {
    const attempt = this.createAttempt(run, step, now, []);
    events.push(
      this.event(run, now, {
        type: 'step-attempt-started',
        stepId: step.id,
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
      }),
    );

    return {
      ...run,
      status: 'running',
      phase: step.phase,
      currentStepId: step.id,
      activeAttemptId: attempt.id,
      attempts: [...run.attempts, attempt],
    };
  }

  private createAttempt(
    run: WorkflowRun,
    step: WorkflowStep,
    now: string,
    inputArtifactRefs: readonly ArtifactReference[],
  ): StepAttempt {
    const attemptNumber =
      run.attempts
        .filter((attempt) => attempt.stepId === step.id)
        .reduce((highest, attempt) => Math.max(highest, attempt.attemptNumber), 0) + 1;

    return {
      id: this.idFactory(),
      runId: run.id,
      stepId: step.id,
      attemptNumber,
      status: 'running',
      inputArtifactRefs,
      outputArtifactRefs: [],
      startedAt: now,
    };
  }

  private finishAttempt(
    run: WorkflowRun,
    attempt: StepAttempt,
    status: StepStatus,
    now: string,
    outputArtifactRefs: readonly ArtifactReference[],
    error: string | undefined,
    events: DomainEvent[],
  ): WorkflowRun {
    const attempts = run.attempts.map((candidate) =>
      candidate.id === attempt.id
        ? { ...candidate, status, outputArtifactRefs, finishedAt: now, error }
        : candidate,
    );
    events.push(
      this.event(run, now, {
        type: 'step-attempt-finished',
        stepId: attempt.stepId,
        attemptId: attempt.id,
        status,
        artifactIds: outputArtifactRefs.map((artifact) => artifact.id),
      }),
    );

    return { ...run, attempts };
  }

  private appendArtifacts(run: WorkflowRun, artifacts: readonly ArtifactReference[]): WorkflowRun {
    const existing = new Set(run.artifacts.map((artifact) => artifact.id));
    return {
      ...run,
      artifacts: [...run.artifacts, ...artifacts.filter((artifact) => !existing.has(artifact.id))],
    };
  }

  private finishRun(
    run: WorkflowRun,
    now: string,
    events: DomainEvent[],
  ): TransitionResult<WorkflowRun> {
    const state: WorkflowRun = {
      ...run,
      status: 'succeeded',
      phase: 'finalization',
      activeAttemptId: null,
    };
    this.addStatusEvent(run, state, now, events);
    events.push(this.event(run, now, { type: 'run-succeeded' }));

    return this.result(state, events, now);
  }

  private result(
    run: WorkflowRun,
    events: readonly DomainEvent[],
    now: string,
  ): TransitionResult<WorkflowRun> {
    return {
      state: { ...run, version: run.version + 1, updatedAt: now },
      events,
    };
  }

  private event(
    run: WorkflowRun,
    occurredAt: string,
    payload: Record<string, unknown>,
  ): DomainEvent {
    return {
      eventId: this.idFactory(),
      runId: run.id,
      occurredAt,
      ...payload,
    } as DomainEvent;
  }

  private addStatusEvent(
    from: WorkflowRun,
    to: WorkflowRun,
    now: string,
    events: DomainEvent[],
  ): void {
    if (from.status === to.status) {
      return;
    }

    events.push(
      this.event(from, now, {
        type: 'run-status-changed',
        from: from.status,
        to: to.status,
        phase: to.phase,
      }),
    );
  }

  private assertDefinition(run: WorkflowRun): void {
    if (
      run.workflowDefinitionId !== this.definition.id ||
      run.workflowDefinitionVersion !== this.definition.version
    ) {
      throw new InvalidTransitionError(
        `Run ${run.id} references workflow ${run.workflowDefinitionId}@${run.workflowDefinitionVersion}, ` +
          `not ${this.definition.id}@${this.definition.version}.`,
      );
    }
  }

  private assertRunning(run: WorkflowRun): void {
    if (run.status !== 'running') {
      throw new InvalidTransitionError(`Run ${run.id} must be running, got ${run.status}.`);
    }
  }

  private requireCurrentStep(run: WorkflowRun, expectedStepId?: string): WorkflowStep {
    if (!run.currentStepId) {
      throw new InvalidTransitionError(`Run ${run.id} has no current step.`);
    }

    if (expectedStepId && run.currentStepId !== expectedStepId) {
      throw new InvalidTransitionError(
        `Run ${run.id} is on step ${run.currentStepId}, not ${expectedStepId}.`,
      );
    }

    return this.requireStep(run.currentStepId);
  }

  private requireStep(stepId: string): WorkflowStep {
    const step = this.definition.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      throw new NotFoundError(`Workflow step ${stepId} was not found.`);
    }

    return step;
  }

  private requireActiveAttempt(run: WorkflowRun, stepId?: string): StepAttempt {
    if (!run.activeAttemptId) {
      throw new InvalidTransitionError(`Run ${run.id} has no active step attempt.`);
    }

    const attempt = run.attempts.find((candidate) => candidate.id === run.activeAttemptId);
    if (!attempt || (stepId && attempt.stepId !== stepId)) {
      throw new InvalidTransitionError(`Run ${run.id} has an invalid active step attempt.`);
    }

    return attempt;
  }

  private latestAttempt(run: WorkflowRun, stepId: string): StepAttempt | undefined {
    return run.attempts
      .filter((attempt) => attempt.stepId === stepId)
      .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
  }

  private requirePendingApproval(
    run: WorkflowRun,
    approvalType: Approval['approvalType'],
  ): Approval {
    const approval = run.approvals.find(
      (candidate) => candidate.approvalType === approvalType && candidate.status === 'pending',
    );
    if (!approval) {
      throw new NotFoundError(`No pending ${approvalType} approval exists on run ${run.id}.`);
    }

    return approval;
  }

  private validateArtifacts(run: WorkflowRun, artifacts: readonly ArtifactReference[]): void {
    for (const artifact of artifacts) {
      if (artifact.runId !== run.id) {
        throw new InvalidInputError(`Artifact ${artifact.id} belongs to another workflow run.`);
      }

      if (!Number.isInteger(artifact.version) || artifact.version < 1) {
        throw new InvalidInputError(`Artifact ${artifact.id} must have a positive version.`);
      }
    }
  }
}

function sameArtifact(left: ArtifactReference, right: ArtifactReference): boolean {
  return (
    left.id === right.id &&
    left.logicalName === right.logicalName &&
    left.version === right.version &&
    left.sha256 === right.sha256
  );
}
