import type { CueInputMode } from '../types';

export type TimeInputErrorCode =
  | 'INVALID_FORMAT'
  | 'INVALID_SEGMENT_RANGE'
  | 'MISSING_ROUTINE_DURATION'
  | 'OUT_OF_RANGE'
  | 'INVALID_MS';

export interface TimeInputError {
  code: TimeInputErrorCode;
  message: string;
  input?: string;
  value?: number;
  min?: number;
  max?: number;
}

export type TimeResult<T> = { ok: true; value: T } | { ok: false; error: TimeInputError };

export interface NormalizeCueOffsetParams {
  inputMs: number;
  inputMode: CueInputMode;
  routineDurationMs?: number;
}

export interface ParseAndNormalizeCueOffsetParams {
  input: string;
  inputMode: CueInputMode;
  routineDurationMs?: number;
}

const DIGITS_ONLY_REGEX = /^\d+$/;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

function createError(error: TimeInputError): TimeResult<never> {
  return { ok: false, error };
}

function createSuccess<T>(value: T): TimeResult<T> {
  return { ok: true, value };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

function validateMilliseconds(value: number, fieldName: string): TimeResult<number> {
  if (!isNonNegativeInteger(value)) {
    return createError({
      code: 'INVALID_MS',
      message: `${fieldName} must be a non-negative integer number of milliseconds.`,
      value,
    });
  }

  return createSuccess(value);
}

function ensureWithinDuration(offsetMs: number, routineDurationMs: number): TimeResult<number> {
  if (offsetMs < 0 || offsetMs > routineDurationMs) {
    return createError({
      code: 'OUT_OF_RANGE',
      message: `Offset must be within [0, ${routineDurationMs}] milliseconds.`,
      value: offsetMs,
      min: 0,
      max: routineDurationMs,
    });
  }

  return createSuccess(offsetMs);
}

function toMilliseconds(hours: number, minutes: number, seconds: number): TimeResult<number> {
  const totalSeconds = hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
  const totalMilliseconds = totalSeconds * MILLISECONDS_PER_SECOND;

  if (!Number.isSafeInteger(totalMilliseconds)) {
    return createError({
      code: 'INVALID_MS',
      message: 'The computed time value is too large.',
      value: totalMilliseconds,
    });
  }

  return createSuccess(totalMilliseconds);
}

export function parseCueTimeToMs(input: string): TimeResult<number> {
  const normalizedInput = input.trim();

  if (normalizedInput.length === 0) {
    return createError({
      code: 'INVALID_FORMAT',
      message: 'Time input cannot be empty.',
      input,
    });
  }

  const segments = normalizedInput.split(':');
  if (segments.length !== 2 && segments.length !== 3) {
    return createError({
      code: 'INVALID_FORMAT',
      message: 'Time must be in mm:ss or hh:mm:ss format.',
      input,
    });
  }

  if (!segments.every((segment) => DIGITS_ONLY_REGEX.test(segment))) {
    return createError({
      code: 'INVALID_FORMAT',
      message: 'Time segments must be numeric.',
      input,
    });
  }

  if (segments.length === 2) {
    const [minutesPart, secondsPart] = segments;
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);

    if (seconds >= SECONDS_PER_MINUTE) {
      return createError({
        code: 'INVALID_SEGMENT_RANGE',
        message: 'Seconds must be between 0 and 59.',
        input,
        value: seconds,
        min: 0,
        max: 59,
      });
    }

    return toMilliseconds(0, minutes, seconds);
  }

  const [hoursPart, minutesPart, secondsPart] = segments;
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);

  if (minutes >= MINUTES_PER_HOUR) {
    return createError({
      code: 'INVALID_SEGMENT_RANGE',
      message: 'Minutes must be between 0 and 59 when using hh:mm:ss.',
      input,
      value: minutes,
      min: 0,
      max: 59,
    });
  }

  if (seconds >= SECONDS_PER_MINUTE) {
    return createError({
      code: 'INVALID_SEGMENT_RANGE',
      message: 'Seconds must be between 0 and 59.',
      input,
      value: seconds,
      min: 0,
      max: 59,
    });
  }

  return toMilliseconds(hours, minutes, seconds);
}

export function formatCueTimeFromMs(ms: number): TimeResult<string> {
  const validatedMs = validateMilliseconds(ms, 'ms');
  if (!validatedMs.ok) {
    return validatedMs;
  }

  if (ms % MILLISECONDS_PER_SECOND !== 0) {
    return createError({
      code: 'INVALID_MS',
      message: 'ms must represent a whole number of seconds.',
      value: ms,
    });
  }

  const totalSeconds = ms / MILLISECONDS_PER_SECOND;
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const pad2 = (value: number): string => value.toString().padStart(2, '0');

  if (hours === 0) {
    const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    return createSuccess(`${pad2(totalMinutes)}:${pad2(seconds)}`);
  }

  return createSuccess(`${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`);
}

export function normalizeCueOffsetMs(params: NormalizeCueOffsetParams): TimeResult<number> {
  const { inputMs, inputMode, routineDurationMs } = params;

  const validatedInput = validateMilliseconds(inputMs, 'inputMs');
  if (!validatedInput.ok) {
    return validatedInput;
  }

  if (inputMode === 'countdown') {
    if (routineDurationMs === undefined) {
      return createError({
        code: 'MISSING_ROUTINE_DURATION',
        message: 'routineDurationMs is required for countdown input mode.',
      });
    }

    const validatedDuration = validateMilliseconds(routineDurationMs, 'routineDurationMs');
    if (!validatedDuration.ok) {
      return validatedDuration;
    }

    const elapsedOffsetMs = routineDurationMs - inputMs;
    return ensureWithinDuration(elapsedOffsetMs, routineDurationMs);
  }

  if (routineDurationMs === undefined) {
    return createSuccess(inputMs);
  }

  const validatedDuration = validateMilliseconds(routineDurationMs, 'routineDurationMs');
  if (!validatedDuration.ok) {
    return validatedDuration;
  }

  return ensureWithinDuration(inputMs, routineDurationMs);
}

export function parseAndNormalizeCueOffsetMs(
  params: ParseAndNormalizeCueOffsetParams
): TimeResult<number> {
  const parsedTime = parseCueTimeToMs(params.input);
  if (!parsedTime.ok) {
    return parsedTime;
  }

  return normalizeCueOffsetMs({
    inputMs: parsedTime.value,
    inputMode: params.inputMode,
    routineDurationMs: params.routineDurationMs,
  });
}
