/// <reference types="jest" />

import { formatSettingsTimeInput } from '../src/utils';

describe('formatSettingsTimeInput', () => {
  it('keeps one or two digit values unchanged', () => {
    expect(formatSettingsTimeInput('0')).toBe('0');
    expect(formatSettingsTimeInput('01')).toBe('01');
  });

  it('preserves one to three digit values', () => {
    expect(formatSettingsTimeInput('100')).toBe('100');
    expect(formatSettingsTimeInput('999')).toBe('999');
  });

  it('formats exactly four digits as mm:ss', () => {
    expect(formatSettingsTimeInput('0100')).toBe('01:00');
    expect(formatSettingsTimeInput('1000')).toBe('10:00');
    expect(formatSettingsTimeInput('1234')).toBe('12:34');
  });

  it('keeps five or more digits unchanged', () => {
    expect(formatSettingsTimeInput('10100')).toBe('10100');
    expect(formatSettingsTimeInput('123456')).toBe('123456');
  });

  it('preserves values that already contain a colon', () => {
    expect(formatSettingsTimeInput('01:00')).toBe('01:00');
    expect(formatSettingsTimeInput('01:')).toBe('01:');
  });

  it('preserves non-digit values and oversized digit values', () => {
    expect(formatSettingsTimeInput('abc')).toBe('abc');
    expect(formatSettingsTimeInput('12a3')).toBe('12a3');
    expect(formatSettingsTimeInput('1234567')).toBe('1234567');
  });
});
