import type { CueActionType, SoundId } from '../types';

export interface CuePreviewInput {
  actionType: CueActionType;
  ttsText?: string;
  soundId?: SoundId;
}

export type CuePreviewCommand = { type: 'sound'; soundId: SoundId } | { type: 'tts'; text: string };

const DEFAULT_PREVIEW_SOUND_ID: SoundId = 'beep';

export function isCuePreviewDisabled(actionType: CueActionType, ttsText: string): boolean {
  if (actionType === 'sound') {
    return false;
  }

  return ttsText.trim().length === 0;
}

export function buildCuePreviewCommands(input: CuePreviewInput): CuePreviewCommand[] {
  const trimmedText = input.ttsText?.trim() ?? '';
  const resolvedSoundId = input.soundId ?? DEFAULT_PREVIEW_SOUND_ID;

  switch (input.actionType) {
    case 'tts':
      return trimmedText.length > 0 ? [{ type: 'tts', text: trimmedText }] : [];
    case 'sound':
      return [{ type: 'sound', soundId: resolvedSoundId }];
    case 'combo':
      if (trimmedText.length === 0) {
        return [];
      }

      return [
        { type: 'sound', soundId: resolvedSoundId },
        { type: 'tts', text: trimmedText },
      ];
    default:
      return [];
  }
}
