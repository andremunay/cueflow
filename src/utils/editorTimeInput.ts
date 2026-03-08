const DIGITS_ONLY_REGEX = /^\d+$/;

function toTwoDigits(value: string): string {
  return value.padStart(2, '0');
}

export function formatSettingsTimeInput(value: string): string {
  if (value.includes(':')) {
    return value;
  }

  if (!DIGITS_ONLY_REGEX.test(value)) {
    return value;
  }

  if (value.length <= 3) {
    return value;
  }

  if (value.length === 4) {
    const seconds = value.slice(-2);
    const minutes = value.slice(0, -2);
    return `${toTwoDigits(minutes)}:${toTwoDigits(seconds)}`;
  }

  return value;
}
