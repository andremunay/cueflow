export type RoutineTransferErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_EXPORT_VERSION'
  | 'INVALID_EXPORT_STRUCTURE'
  | 'INVALID_ROUTINE_CONTENT'
  | 'ROUTINE_VALIDATION_FAILED'
  | 'DUPLICATE_ROUTINE_ID'
  | 'SHARING_UNAVAILABLE'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED';

export class RoutineTransferError extends Error {
  public readonly code: RoutineTransferErrorCode;

  public constructor(code: RoutineTransferErrorCode, message: string) {
    super(message);
    this.name = 'RoutineTransferError';
    this.code = code;
  }
}
