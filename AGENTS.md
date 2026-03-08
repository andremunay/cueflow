# Cue Builder - Current Project State

Note: `PLAN.md` documents the original implementation sequence. `README.md` is the user-facing setup and QA guide. This file should describe the repository as it exists today so contributors and coding agents work from the current source of truth.

## Workflow Rule
- Do not mention step numbers (for example, "based on step 2") in branch names or anywhere in a pull request.

## Pull Request Workflow

When creating a pull request, include the following sections:

### What
Provide a short description of the change.

### Why
Explain why the change is needed.

### How
Summarize the implementation approach in a few bullet points.

### Testing
Document how the change was verified:
- Automated:
- Manual:

### Risks
Describe any migration, compatibility, rollout, or operational concerns.

### Notes for Reviewers
Highlight where reviewers should focus, what was intentionally deferred, and any context that will make review faster and more effective.

## Overview

Cue Builder is an offline-first Expo + React Native app for building and running timed cue routines with text-to-speech, bundled sound effects, optional heads-up pings, import/export, and local persistence.

The repository currently contains a functional MVP with:
- a routine library
- a routine editor
- a playback screen
- AsyncStorage persistence
- JSON import/export
- bundled audio assets
- unit tests for the core logic

## Current Stack

- Expo SDK `55`
- React `19`
- React Native `0.83`
- TypeScript
- React Navigation native stack
- AsyncStorage
- Expo Audio
- Expo Speech
- Expo Haptics
- Expo Document Picker
- Expo File System
- Expo Sharing

## Current App Flow

### Library Screen
- Loads saved routines from AsyncStorage.
- Supports search across routine name and tags.
- Supports creating a new routine.
- Supports JSON import through file picker.
- Supports JSON export through the OS share sheet.
- Supports in-place favorite toggling.
- Tapping a routine card opens playback.
- The Edit action opens the routine editor.
- Empty state includes:
  - `Start with a preset` -> placeholder screen
  - `Create custom routine`

### Routine Editor Screen
- Supports create and edit flows.
- Edits routine name, tags, and favorite state.
- Requires routine duration.
- Includes configurable routine start delay.
- Includes routine heads-up toggle and routine heads-up lead time.
- Includes haptics toggle.
- Includes duck flag toggle labeled as planned/no-op.
- Cue rows support:
  - cue time input (`mm:ss` or `hh:mm:ss`)
  - action type (`tts`, `sound`, `combo`)
  - TTS text
  - sound selection (`beep`, `chime`, `whistle`)
  - heads-up override (`inherit`, `off`, `on`)
  - optional cue-specific heads-up lead time when override is `on`
  - preview
  - duplicate
  - delete
  - collapse/expand
- Cues auto-order by normalized elapsed time when their time values are valid.
- Save is blocked on errors and allowed on warnings.
- Edit mode includes:
  - unsaved-change prompt when leaving
  - delete routine action
  - `Play Saved Routine` button that runs the last saved version

### Playback Screen
- Loads a saved routine by id.
- Displays routine name, status, elapsed clock, next cue, and upcoming cues.
- Supports:
  - Start
  - Pause
  - Resume
  - Stop
  - Skip Next
  - Replay Last
- Highlights the current upcoming cue.
- Marks fired cues visually.

## Current Data Model

### Export Wrapper
```json
{
  "version": 1,
  "routine": { "...": "Routine payload" }
}
```

### Routine
```ts
{
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  routineDurationMs: number;
  startDelayMs: number;
  headsUpEnabled: boolean;
  headsUpLeadTimeMs: number;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  cues: Cue[];
}
```

### Cue
```ts
{
  id: string;
  offsetMs: number;
  actionType: 'tts' | 'sound' | 'combo';
  ttsText?: string;
  soundId?: 'beep' | 'chime' | 'whistle';
  headsUpOverride: 'inherit' | 'off' | 'on';
  headsUpLeadTimeMs?: number;
}
```

## Current Timing and Playback Behavior

- Routine start delay defaults to `3000` ms.
- Routine heads-up lead time defaults to `1000` ms.
- Heads-up is beep-only.
- Heads-up timing is configurable at the routine level.
- A cue with heads-up override `on` may also carry a cue-specific lead time.
- Combo cue behavior is sound first, then TTS.
- Haptics fire at cue time only when enabled.
- The playback scheduler computes elapsed time from system time instead of chaining one timer per cue.
- Target playback tick interval is `150` ms.
- Pause/resume works by tracking total paused duration.
- Skip Next immediately fires the next cue action and marks that cue as already handled.
- Replay Last re-fires only the last cue action and does not replay heads-up audio.

## Validation and Limits

- Maximum routine duration: `7_200_000` ms (2 hours)
- Maximum cue count: `200`
- Routine duration is required and must be a positive integer number of milliseconds.
- Cue times must be non-negative.
- Cue times must fall within the routine duration.
- Duplicate cue timestamps are validation errors.
- Cue count above the max is a validation error.
- Duration above the max is a validation error.
- Out-of-order cues are validation warnings.
- Near-overlapping cues are validation warnings.
- Overlap warning threshold is `3000` ms.
- Save is blocked on validation errors and allowed on warnings.
- Import is blocked on validation errors and allowed on warnings.

## Storage and Transfer

- Local storage key: `@cue-builder/routines`
- Local storage snapshot version: `1`
- Export wrapper version: `1`
- Storage serialization is strict and rejects unsupported structures.
- Storage and import serialization reject duplicate cue ids.
- Import rejects invalid JSON, unsupported versions, incompatible payload shapes, and invalid routine content.
- Storage lives in `src/services/routineStorage.ts`; there is no separate `src/store/` implementation at the moment.

## Background Playback

- `app.json` enables the `expo-audio` plugin with background playback support.
- Background playback is best effort and platform dependent.
- Validate background behavior in development builds, not only Expo Go.
- iOS and Android may still interrupt or delay playback depending on OS policy, device behavior, or long quiet periods.

## Repository Layout

Current source layout:

```text
cueflow/
  assets/
    sounds/
      beep.wav
      chime.wav
      whistle.wav
  src/
    components/
      editor/
    constants/
    hooks/
    navigation/
    screens/
    services/
    types/
    utils/
  tests/
  App.tsx
  app.json
  index.ts
  package.json
  README.md
  PLAN.md
```

Notes:
- `src/hooks/` currently exists as a placeholder only.
- `src/store/` is not present; storage logic lives under `src/services/`.
- `dist/` may be present in the repository, but the source of truth for application code is `src/` plus the root Expo entry files.

## Current Gaps and Non-Goals

- No timeline editor.
- No preset library beyond the placeholder screen.
- No cloud sync, accounts, or authentication.
- No custom sound import.
- No layered audio behavior beyond combo ping + TTS.
- No guaranteed overlay/mixing behavior with external audio apps.
- Duck flag is persisted but currently has no runtime effect.
- Countdown-vs-elapsed cue entry mode is not implemented in the current editor; cue times are currently entered as elapsed offsets only.

## Test Status

Latest local verification in this repository:
- `npm test -- --runInBand`
- Result: `14` test suites passed, `132` tests passed

Current automated test coverage includes:
- time parsing and formatting
- editor time input formatting
- cue preview command generation
- routine validation
- editor transforms
- cue expansion helpers
- library filtering
- playback display formatting
- playback scheduler math
- playback controller behavior
- storage serialization
- storage service CRUD behavior
- transfer serialization
- import/export behavior
