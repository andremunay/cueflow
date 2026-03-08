/// <reference types="jest" />

import { buildCuePreviewCommands, isCuePreviewDisabled } from '../src/utils';

describe('isCuePreviewDisabled', () => {
  it('disables preview for tts cues with empty text', () => {
    expect(isCuePreviewDisabled('tts', '')).toBe(true);
    expect(isCuePreviewDisabled('tts', '   ')).toBe(true);
  });

  it('disables preview for combo cues with empty text', () => {
    expect(isCuePreviewDisabled('combo', '')).toBe(true);
  });

  it('keeps preview enabled for sound cues', () => {
    expect(isCuePreviewDisabled('sound', '')).toBe(false);
  });
});

describe('buildCuePreviewCommands', () => {
  it('maps tts cues to a single speak command with trimmed text', () => {
    expect(
      buildCuePreviewCommands({
        actionType: 'tts',
        ttsText: '  Speak now  ',
      })
    ).toEqual([{ type: 'tts', text: 'Speak now' }]);
  });

  it('maps sound cues to a single sound command and defaults to beep', () => {
    expect(
      buildCuePreviewCommands({
        actionType: 'sound',
      })
    ).toEqual([{ type: 'sound', soundId: 'beep' }]);
  });

  it('maps combo cues to sound then tts commands', () => {
    expect(
      buildCuePreviewCommands({
        actionType: 'combo',
        soundId: 'whistle',
        ttsText: 'Go',
      })
    ).toEqual([
      { type: 'sound', soundId: 'whistle' },
      { type: 'tts', text: 'Go' },
    ]);
  });

  it('returns no commands when tts/combo text is blank', () => {
    expect(
      buildCuePreviewCommands({
        actionType: 'tts',
        ttsText: '   ',
      })
    ).toEqual([]);
    expect(
      buildCuePreviewCommands({
        actionType: 'combo',
        soundId: 'chime',
        ttsText: '',
      })
    ).toEqual([]);
  });
});
