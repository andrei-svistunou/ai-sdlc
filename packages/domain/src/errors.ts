export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TRANSITION'
  | 'INVARIANT_VIOLATION'
  | 'NOT_FOUND'
  | 'APPROVAL_MISMATCH'
  | 'LIMIT_EXCEEDED';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  public constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class InvalidInputError extends DomainError {
  public constructor(message: string) {
    super('INVALID_INPUT', message);
    this.name = 'InvalidInputError';
  }
}

export class InvalidTransitionError extends DomainError {
  public constructor(message: string) {
    super('INVALID_TRANSITION', message);
    this.name = 'InvalidTransitionError';
  }
}

export class InvariantViolationError extends DomainError {
  public constructor(message: string) {
    super('INVARIANT_VIOLATION', message);
    this.name = 'InvariantViolationError';
  }
}

export class NotFoundError extends DomainError {
  public constructor(message: string) {
    super('NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ApprovalMismatchError extends DomainError {
  public constructor(message: string) {
    super('APPROVAL_MISMATCH', message);
    this.name = 'ApprovalMismatchError';
  }
}

export class LimitExceededError extends DomainError {
  public constructor(message: string) {
    super('LIMIT_EXCEEDED', message);
    this.name = 'LimitExceededError';
  }
}
