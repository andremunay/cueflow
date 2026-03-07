# Cue Builder

Cue Builder is an Expo + React Native app written in TypeScript.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npx expo start
   ```

From the Expo CLI, launch on Android, iOS, or web.

## Background Playback (Best Effort)

Cue Builder is configured for best-effort background playback, but behavior depends on operating system policy and device state.

- Android:
  - Expo Audio background playback support is enabled, including media playback foreground service wiring from the `expo-audio` config plugin.
  - Playback can still be interrupted by aggressive battery optimization, OEM task management, force-close actions, or app process death.
- iOS:
  - Audio background mode is enabled through Expo config plugin output, and playback/TTS is routed through the app audio session.
  - iOS can suspend background apps, especially during long silent gaps between cues, so exact timing is not guaranteed while backgrounded.
- Expo Go vs dev builds:
  - Validate background behavior with a development build (`npx expo run:android` / `npx expo run:ios` or EAS dev build). Expo Go may not reflect all native plugin behavior.
- Timing guidance:
  - For strict cue timing reliability, keep the app in the foreground and screen awake when possible.
