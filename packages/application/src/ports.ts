import type {
  AgentRole,
  ArtifactReference,
  ArtifactKind,
  Task,
  TaskId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowStepId,
} from '@ai-sdlc/domain';

export interface CorrelationContext {
  readonly correlationId: string;
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowStepId: WorkflowStepId;
  readonly stepAttemptId?: string;
  readonly agentSessionId?: string;
}

export interface SkillReference {
  readonly name: string;
  readonly version?: string;
}

export interface AgentCapabilities {
  readonly providerType: string;
  readonly roles: readonly AgentRole[];
  readonly supportsStreaming: boolean;
  readonly supportsCancellation: boolean;
}

export interface CreateAgentSessionInput {
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowStepId: WorkflowStepId;
  readonly role: AgentRole;
  readonly correlation: CorrelationContext;
}

export interface AgentSessionHandle {
  readonly sessionId: string;
  readonly providerType: string;
}

export interface WorkspaceHandle {
  readonly workspaceId: string;
  readonly rootPath: string;
  readonly branchName: string;
}

export interface StructuredOutputContract {
  readonly name: string;
  readonly schemaVersion: number;
  readonly description: string;
}

export type AgentStepStatus = 'completed' | 'needs-input' | 'blocked' | 'failed';

export interface ProposedQuestion {
  readonly prompt: string;
}

export interface ProducedArtifact {
  readonly logicalName: string;
  readonly kind: ArtifactKind;
  readonly contentType: string;
  readonly content: string | Uint8Array;
}

export interface ObservedAction {
  readonly type: 'command' | 'file-change' | 'tool';
  readonly summary: string;
}

export interface AgentStepResult<T> {
  readonly schemaVersion: 1;
  readonly status: AgentStepStatus;
  readonly summary: string;
  readonly data?: T;
  readonly questions?: readonly ProposedQuestion[];
  readonly producedArtifacts: readonly ProducedArtifact[];
  readonly actions: readonly ObservedAction[];
}

export interface AgentPermissionSet {
  readonly readWorkspace: boolean;
  readonly writeWorkspace: boolean;
  readonly executeCommands: boolean;
  readonly allowedCommands: readonly string[];
}

export interface AgentExecutionRequest {
  readonly role: AgentRole;
  readonly skillRefs: readonly SkillReference[];
  readonly workspace: WorkspaceHandle;
  readonly inputArtifactRefs: readonly ArtifactReference[];
  readonly outputContract: StructuredOutputContract;
  readonly permissions: AgentPermissionSet;
  readonly correlation: CorrelationContext;
}

export type AgentExecutionEvent =
  | {
      readonly type: 'message';
      readonly text: string;
    }
  | {
      readonly type: 'progress';
      readonly summary: string;
    }
  | {
      readonly type: 'tool-approval-requested';
      readonly toolName: string;
      readonly reason: string;
    }
  | {
      readonly type: 'completed';
      readonly output: AgentStepResult<unknown>;
    }
  | {
      readonly type: 'failed';
      readonly message: string;
    };

export interface AgentProvider {
  readonly providerType: string;

  getCapabilities(): Promise<AgentCapabilities>;
  createSession(input: CreateAgentSessionInput): Promise<AgentSessionHandle>;
  execute(
    session: AgentSessionHandle,
    request: AgentExecutionRequest,
  ): AsyncIterable<AgentExecutionEvent>;
  cancel(session: AgentSessionHandle): Promise<void>;
}

export interface CreateWorkspaceInput {
  readonly workflowRunId: WorkflowRunId;
  readonly repositoryPath: string;
  readonly branchName: string;
  readonly baseRef?: string;
}

export interface WorkspaceState {
  readonly rootPath: string;
  readonly branchName: string;
  readonly clean: boolean;
  readonly changedFiles: readonly string[];
}

export interface GitDiffArtifact {
  readonly content: string;
  readonly changedFiles: readonly string[];
}

export interface CommitInput {
  readonly message: string;
}

export interface CommitInfo {
  readonly commitId: string;
  readonly message: string;
}

export interface WorkspaceProvider {
  create(input: CreateWorkspaceInput): Promise<WorkspaceHandle>;
  inspect(handle: WorkspaceHandle): Promise<WorkspaceState>;
  diff(handle: WorkspaceHandle): Promise<GitDiffArtifact>;
  commit(handle: WorkspaceHandle, input: CommitInput): Promise<CommitInfo>;
  dispose(handle: WorkspaceHandle): Promise<void>;
}

export interface CommandExecutionInput {
  readonly executionId: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds: number;
  readonly correlation: CorrelationContext;
}

export interface CommandExecutionResult {
  readonly executionId: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
}

export interface CommandRunner {
  execute(input: CommandExecutionInput): Promise<CommandExecutionResult>;
  cancel(executionId: string): Promise<void>;
}

export interface PutArtifactInput {
  readonly runId: WorkflowRunId;
  readonly logicalName: string;
  readonly version: number;
  readonly kind: ArtifactKind;
  readonly contentType: string;
  readonly content: string | Uint8Array;
}

export interface ArtifactContent {
  readonly ref: ArtifactReference;
  readonly content: string | Uint8Array;
}

export interface ArtifactStore {
  put(input: PutArtifactInput): Promise<ArtifactReference>;
  get(ref: ArtifactReference): Promise<ArtifactContent>;
  list(runId: WorkflowRunId): Promise<ArtifactReference[]>;
}

export interface TaskQuery {
  readonly repositoryId?: string;
}

export interface TaskStore {
  create(task: Task): Promise<void>;
  get(taskId: TaskId): Promise<Task | null>;
  list(query?: TaskQuery): Promise<Task[]>;
}

export interface RunQuery {
  readonly taskId?: TaskId;
  readonly status?: WorkflowRun['status'];
}

export interface RunStore {
  create(run: WorkflowRun): Promise<void>;
  get(runId: WorkflowRunId): Promise<WorkflowRun | null>;
  save(run: WorkflowRun, expectedVersion: number): Promise<void>;
  list(query?: RunQuery): Promise<WorkflowRun[]>;
}

export interface SecretReference {
  readonly name: string;
}

export interface ResolvedSecret {
  readonly value: string;
  readonly expiresAt?: string;
}

export interface SecretProvider {
  resolve(ref: SecretReference): Promise<ResolvedSecret>;
}
