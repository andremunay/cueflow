/// <reference types="jest" />

import {
  createExpandedCueStateForAddedCue,
  getCollapsedCueTimeLabel,
  toggleCueExpandedState,
} from '../src/utils';

describe('createExpandedCueStateForAddedCue', () => {
  it('returns a map with only the added cue expanded', () => {
    expect(createExpandedCueStateForAddedCue('cue-3')).toEqual({
      'cue-3': true,
    });
  });
});

describe('toggleCueExpandedState', () => {
  it('expands a collapsed cue', () => {
    const expanded = toggleCueExpandedState({}, 'cue-1');

    expect(expanded).toEqual({
      'cue-1': true,
    });
  });

  it('collapses an expanded cue', () => {
    const expanded = toggleCueExpandedState(
      {
        'cue-1': true,
        'cue-2': true,
      },
      'cue-1'
    );

    expect(expanded).toEqual({
      'cue-2': true,
    });
  });
});

describe('getCollapsedCueTimeLabel', () => {
  it('returns cue time when it is valid', () => {
    expect(getCollapsedCueTimeLabel('01:30')).toBe('01:30');
  });

  it('returns placeholder when time is blank or invalid', () => {
    expect(getCollapsedCueTimeLabel('')).toBe('--:--');
    expect(getCollapsedCueTimeLabel('100')).toBe('--:--');
    expect(getCollapsedCueTimeLabel('99:99')).toBe('--:--');
  });
});
