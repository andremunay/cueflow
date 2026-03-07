import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';
import type { SoundId } from '../types';

const SOUND_ASSET_BY_ID: Readonly<Record<SoundId, number>> = {
  beep: require('../../assets/sounds/beep.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  whistle: require('../../assets/sounds/whistle.wav'),
};

const soundPlayers: Partial<Record<SoundId, AudioPlayer>> = {};
let audioModeConfigured = false;
let audioModeConfigurationPromise: Promise<void> | null = null;

async function ensureAudioModeConfigured(): Promise<void> {
  if (audioModeConfigured) {
    return;
  }

  if (!audioModeConfigurationPromise) {
    audioModeConfigurationPromise = setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      // Background playback is best effort and still subject to OS lifecycle policies.
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    })
      .then(() => {
        audioModeConfigured = true;
      })
      .catch((error: unknown) => {
        audioModeConfigurationPromise = null;
        throw error;
      })
      .finally(() => {
        if (audioModeConfigured) {
          audioModeConfigurationPromise = null;
        }
    });
  }

  await audioModeConfigurationPromise;
}

function getOrCreateSoundPlayer(soundId: SoundId): AudioPlayer {
  const existing = soundPlayers[soundId];
  if (existing) {
    return existing;
  }

  const player = createAudioPlayer(SOUND_ASSET_BY_ID[soundId], {
    keepAudioSessionActive: true,
  });
  soundPlayers[soundId] = player;
  return player;
}

export async function playSound(soundId: SoundId): Promise<void> {
  await ensureAudioModeConfigured();

  const player = getOrCreateSoundPlayer(soundId);

  try {
    await player.seekTo(0);
  } catch {
    // The first call can race source loading; play() still starts once ready.
  }

  player.play();
}

export interface SpeakTextOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  interrupt?: boolean;
}

export async function speakText(text: string, options: SpeakTextOptions = {}): Promise<void> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return;
  }

  await ensureAudioModeConfigured();

  if (options.interrupt !== false) {
    await Speech.stop();
  }

  // System voice availability and pronunciation differ by OS and installed voices.
  Speech.speak(normalizedText, {
    language: options.language ?? 'en-US',
    rate: options.rate,
    pitch: options.pitch,
    useApplicationAudioSession: true,
  });
}

export async function triggerHaptic(): Promise<void> {
  if (Platform.OS === 'web') {
    // Browser haptics support is inconsistent, so this is a no-op on web.
    return;
  }

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Some devices disable native haptics; vibration keeps feedback behavior consistent.
    Vibration.vibrate(35);
  }
}
