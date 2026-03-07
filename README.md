# Cue Builder

Cue Builder is an offline-first Expo + React Native app for building and running timed cue routines with text-to-speech, sound effects, and optional heads-up pings.

## Setup and Run

### Prerequisites

- Node.js LTS and npm
- Expo-compatible simulator/emulator or physical device

### Install

```bash
npm install
```

### Start the app

```bash
npx expo start
```

From the Expo CLI, launch on Android, iOS, or web.

### Development build note (background playback validation)

Background behavior should be validated in a development build, not only Expo Go:

```bash
npx expo run:android
npx expo run:ios
```

### Run automated tests

```bash
npm test -- --runInBand
```

Latest local verification in this repository: `10` test suites passed, `87` tests passed.

## Feature Overview

### Library Screen

- Displays saved routines with name, tags, and favorite star.
- Includes search across routine name and tags.
- Supports creating a new routine.
- Supports JSON import and export entry points.
- Empty state includes:
  - `Start with a preset` -> `Presets coming soon` placeholder.
  - `Create custom routine`.

### Routine Editor Screen

- Edits routine metadata: name, tags, favorite.
- Requires routine duration before reliable countdown entry.
- Includes toggles for default heads-up, haptics, and duck flag (`planned/no-op`).
- Cue rows support:
  - Time entry (`mm:ss` or `hh:mm:ss`)
  - Entry mode (`elapsed` or `countdown`)
  - Action type (`tts`, `sound`, `combo`)
  - TTS text, sound selection, heads-up override (`inherit` / `off` / `on`)
  - Reorder, duplicate, and delete row actions
- Validation distinguishes warnings from errors.
- Save is blocked on errors and allowed on warnings.
- `Play Saved Routine` launches playback using persisted routine data.

### Playback Screen

- Shows routine name, status, elapsed clock, and next cue.
- Provides controls: Start, Pause, Resume, Stop, Skip Next, Replay Last.
- Highlights current cue in upcoming list.
- Scheduling is drift-resistant:
  - computes elapsed from system time,
  - tracks total paused duration,
  - uses interval ticks instead of one timer per cue.
- Heads-up behavior:
  - ping-only, 3 seconds before cue time,
  - no spoken countdown,
  - deduplicated so heads-up/cue events do not double-fire.

## Data and Local Storage

### Local persistence

- Storage backend: AsyncStorage.
- Storage key: `@cue-builder/routines`.
- Works offline; no accounts or cloud sync.
- Routines persist across app restarts on the same device/app install.

### Routine model (stored locally)

```ts
{
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  routineDurationMs: number;
  defaultHeadsUpEnabled: boolean;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  cues: Cue[];
}
```

### Current limits

- Maximum routine duration: 2 hours (`7_200_000 ms`)
- Maximum cues per routine: 200

## Import and Export

- Export format is versioned JSON:

```json
{
  "version": 1,
  "routine": { "...": "Routine payload" }
}
```

- Export uses the OS share sheet.
- Import uses file picker + JSON validation.
- Import rejects invalid JSON, unsupported versions, invalid structure/content, and validation-error routines.
- Import may succeed with warnings when no validation errors exist.

## Architecture Summary

- `App.tsx` + `src/navigation/RootNavigator.tsx`: app entry and stack navigation.
- `src/screens`: Library, Routine Editor, Playback, Presets placeholder.
- `src/components/editor`: reusable editor controls and cue row UI.
- `src/services`:
  - `routineStorage*`: AsyncStorage CRUD + serialization/migration shape handling
  - `playbackScheduler` + `playbackController`: deterministic scheduling and control semantics
  - `media`: sound playback, TTS, haptics wrappers
  - `routineTransfer*`: import/export serialization and validation
- `src/utils`: time parsing/formatting, normalization, validation, editor transforms, library filtering.
- `src/types` + `src/constants`: domain model and shared limits/config.
- `tests`: unit tests for pure logic and controller behavior.

## Background Playback Constraints (Best Effort)

Cue Builder enables background playback via Expo Audio config, but exact behavior depends on OS and device policy.

- Android
  - Background playback support is enabled through `expo-audio`.
  - Playback can still be interrupted by battery optimization, OEM task killers, force-close, or process death.
- iOS
  - Background audio mode is enabled for app audio session usage.
  - iOS may suspend the app during long quiet periods; exact cue timing while backgrounded is not guaranteed.
- Expo Go versus development builds
  - Native plugin behavior can differ in Expo Go.
  - Use `npx expo run:android` / `npx expo run:ios` or EAS dev builds for realistic validation.
- Reliability guidance
  - For strict timing, keep app foregrounded and screen awake when possible.

## Known Limitations and Non-Goals

- No timeline editor (list/table editor only).
- No cloud sync, accounts, or authentication.
- No preset library beyond placeholder screen.
- No custom sound import.
- No layered audio actions beyond combo ping + TTS.
- No non-English TTS guarantees.
- No external audio overlay/mixing guarantees with other apps.
- Duck flag exists in model/UI as planned behavior and is currently a no-op.

## Manual QA Checklist

Use this checklist on at least one Android device and one iOS device when possible.

- [ ] App setup and launch
  - Pass: `npm install` succeeds and `npx expo start` launches app.
- [ ] Create, edit, save, and restart persistence
  - Pass: create a routine with at least 6 cues, save, restart app, and routine remains available with unchanged values.
- [ ] Search and tags
  - Pass: search query matches routine name and tags; non-matches are filtered out.
- [ ] Favorite toggle
  - Pass: favorite star updates in library and remains correct after reload.
- [ ] TTS-only cue
  - Pass: cue with `tts` action speaks expected text at expected time.
- [ ] Sound-only cue
  - Pass: cues play selected `beep`, `chime`, and `whistle` sounds.
- [ ] Combo cue
  - Pass: cue with `combo` plays sound then voice at cue time.
- [ ] Heads-up behavior with default and override
  - Pass: eligible cues fire ping-only heads-up at `t-3s`; override `off` suppresses it; override `on` forces it even if default is off.
- [ ] Pause and resume shifting
  - Pass: pause for about 10 seconds, resume, and remaining cues execute about 10 seconds later than pre-pause schedule.
- [ ] Skip Next behavior
  - Pass: tapping `Skip Next` immediately fires next cue action and advances playback state without duplicate later firing.
- [ ] Replay Last behavior
  - Pass: tapping `Replay Last` replays only the last executed cue action and does not replay heads-up.
- [ ] Import/export round-trip
  - Pass: export a routine, import it, and confirm name/tags/settings/cues are preserved.
- [ ] Background and locked-screen behavior
  - Pass: verify best-effort continuation in background/locked screen, and document observed platform/device limitations.

## Notes for Testers

- Heads-up is intentionally sound-only (beep) and does not speak countdown text.
- Haptics fire at cue time (when enabled), not at heads-up time.
- Validation warnings do not block save; validation errors do block save.
