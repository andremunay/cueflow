export type RoutineStorageErrorCode =
  | 'INVALID_STORAGE_FORMAT'
  | 'DUPLICATE_ROUTINE_ID'
  | 'ROUTINE_NOT_FOUND';

export class RoutineStorageError extends Error {
  public readonly code: RoutineStorageErrorCode;

  public constructor(code: RoutineStorageErrorCode, message: string) {
    super(message);
    this.name = 'RoutineStorageError';
    this.code = code;
  }
}
