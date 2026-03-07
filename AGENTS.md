# Cue Builder — Project Details

Note: Sequential implementation steps are documented in `PLAN.md` at the repository root.

## Overview
Cue Builder is a cross-platform mobile MVP built with React Native and Expo. It lets users create timed routines made of timestamped cues and play them back hands-free using system text-to-speech, optional sound pings, and a heads-up alert feature. The app is offline-first, stores data locally, and requires no accounts or paid services.

The product is designed for people who need guided routines with precise timing, such as workouts, breathing exercises, rehearsal blocks, coaching sequences, practice drills, and personal routines.

## Product Goal
Build a production-quality MVP for a mobile “Cue Builder” app where users create routines as timestamped cues and play them hands-free with system TTS and optional sound pings, including a heads-up feature.

## Primary Users
- Individuals creating timed personal routines
- Coaches or instructors building reusable cue sequences
- Performers, speakers, or athletes rehearsing timed steps
- Anyone who needs audible prompts while keeping hands free

## Core User Value
Users can build, save, organize, and run routines without needing internet access, accounts, or manual interaction during playback.

## MVP Scope

### Included
- Cross-platform mobile app using React Native + Expo + TypeScript
- Offline-first local storage with AsyncStorage
- Routine library with save/edit/name, favorites, tags, and search
- Routine editor using a table/list editor only
- Required routine duration field
- Cue time entry in both elapsed and countdown modes
- Internal normalization to elapsed offsets from start in milliseconds
- Cue action types:
  - TTS phrase
  - Built-in sound effect
  - Combo: ping then voice
- Bundled sound assets:
  - beep
  - chime
  - whistle
- Heads-up support:
  - routine default heads-up setting
  - per-cue override: inherit / off / on
  - fixed MVP behavior: ping-only at t-3s
- Playback controls:
  - Start
  - Pause
  - Resume
  - Stop
  - Skip to Next Cue
  - Replay Last Cue
- Pause/resume schedule shifting based on paused duration
- Optional haptics/vibration at cue time
- Duck flag in model and UI labeled as planned/no-op
- JSON export/import using share sheet and file picker
- README with setup, limitations, and QA checklist
- Unit tests for pure functions

### Explicitly Excluded
- Timeline editor
- Full preset library
- Playing over external audio with overlay/interrupt behavior
- Audio mixing with other apps
- Custom sound import
- Layered sound actions beyond combo ping+voice
- Custom voice upload
- Voice controls
- Non-English TTS
- Cloud sync
- Accounts/auth
- Folders/categories/advanced sorting/filtering
- Paid services

## Product Requirements

### Routine Limits
- Maximum routine duration: 2 hours
- Maximum cues per routine: 200

### Time Entry Rules
- Routine duration is required
- Support two UI input modes:
  - elapsed offset
  - countdown
- Countdown conversion:
  - `remainingMs = user entry`
  - `elapsedOffsetMs = routineDurationMs - remainingMs`
- Validation:
  - elapsed offset must be within `[0, routineDurationMs]`
  - no negative times

### Validation Rules
Errors:
- negative times
- duplicate timestamps
- routine duration over 2 hours
- cue count over 200
- invalid countdown conversion outside duration bounds

Warnings:
- overlaps
- out-of-order cues

Save behavior:
- Save is blocked on errors
- Save remains allowed on warnings

## Required Screens

### Library Screen
Must include:
- list of routines
- name, tags, favorite star visible in list
- search bar searching name + tags
- new routine button
- export/import entry points
- empty state with:
  - “Start with a preset” → placeholder message/screen: “Presets coming soon”
  - “Create custom routine”

### Routine Editor Screen
Must include:
- name
- tags
- favorite toggle
- routine duration
- default heads-up toggle
- haptics toggle
- duck flag toggle labeled planned/no-op
- cue list editor with rows containing:
  - time input (`mm:ss` or `hh:mm:ss`)
  - entry mode: elapsed vs countdown
  - action type: TTS / Sound / Combo
  - text content for TTS
  - sound selector for sound/combo
  - per-cue heads-up override: inherit / off / on
  - reorder up/down
  - duplicate
  - delete
- inline warnings and errors
- Save button blocked on errors

### Playback Screen or Playback Panel
Must include:
- routine name
- elapsed clock
- next cue time/action
- controls: Start, Pause, Resume, Stop, Skip Next, Replay Last
- upcoming cue list with current cue highlighted

## Playback Behavior

### Scheduling Strategy
To minimize drift:
- track `routineStartTime`
- compute elapsed using system time rather than chained timeouts
- track `totalPausedMs`
- use a short interval tick (100–250ms)
- detect crossing cue times robustly
- do not schedule 200 independent timers

### Heads-Up Behavior
- heads-up is ping-only at 3 seconds before cue time
- no spoken countdown
- per-cue override can inherit, disable, or force enable
- prevent double-firing using explicit fired tracking

### Cue Execution
At cue time:
- optional heads-up ping may already have fired at t-3s
- fire cue action:
  - TTS
  - sound
  - combo ping then TTS
- optional haptic at cue time
- document whether haptic also fires at heads-up; MVP should choose one behavior and keep it consistent

### Playback Control Semantics
- **Start**: begin from time zero
- **Pause**: suspend progress
- **Resume**: shift remaining cues forward by paused duration so timeline continues from current time
- **Stop**: end playback and reset execution state
- **Skip to Next Cue**: immediately jump to next cue and fire its action
- **Replay Last Cue**: immediately re-fire last executed cue action only; do not replay heads-up

## Background Playback
Best-effort background playback is required. Implementation may use Expo config plugins or a custom dev client if needed. Platform constraints must be documented honestly in the README, especially around locked-screen/background behavior on iOS and Android.

## Data Model

### Export Wrapper
```json
{
  "version": 1,
  "routine": { ... }
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
  defaultHeadsUpEnabled: boolean;
  hapticsEnabled: boolean;
  duckPlannedFlag: boolean;
  cues: Cue[];
}
```

### Cue
```ts
{
  id: string;
  offsetMs: number; // normalized elapsed offset
  inputMode: 'elapsed' | 'countdown';
  actionType: 'tts' | 'sound' | 'combo';
  ttsText?: string;
  soundId?: 'beep' | 'chime' | 'whistle';
  headsUpOverride: 'inherit' | 'off' | 'on';
}
```

## Technical Architecture

### Stack
- React Native
- Expo
- TypeScript
- React Navigation
- AsyncStorage

### Suggested App Layers
- `app/` or `src/` screens and navigation
- reusable UI components
- domain types and constants
- storage layer for routines
- playback engine / scheduler
- utility layer for parsing, normalization, and validation
- import/export service
- sound/TTS/haptics service wrappers
- test suite for pure logic

### Key Services
- **Storage service**: save/load/update/delete routines in AsyncStorage
- **Validation service**: routine and cue validation with warnings vs errors
- **Time utility service**: parse/format times and convert countdown to elapsed offsets
- **Playback engine**: schedule ticking, fired tracking, pause/resume shifting, skip/replay logic
- **Media service**: play bundled sounds, invoke system TTS, trigger haptics
- **Import/export service**: serialize/deserialize versioned JSON and integrate with picker/share APIs

## UX Notes
- Keep the editor simple and table-like; do not introduce a timeline UI
- Preserve clarity between warnings and errors
- Make countdown entry understandable by clearly requiring routine duration first
- Keep the playback screen highly legible with current status and next cue visibility
- Empty state should guide users while acknowledging presets are not yet available

## Suggested File/Folder Structure
```text
cue-builder/
  assets/
    sounds/
      beep.wav
      chime.wav
      whistle.wav
  src/
    components/
    screens/
    navigation/
    hooks/
    services/
    store/
    utils/
    types/
    constants/
  tests/
  App.tsx
  app.json
  package.json
  README.md
```

## Acceptance Criteria
1. Create a routine with 6 cues, validate times, save it, restart app, and verify persistence.
2. Playback fires cues in correct order and supports both TTS and sound cues.
3. Pause for about 10 seconds, resume, and remaining cues shift later correctly.
4. Heads-up works using routine default and per-cue override rules.
5. TTS-only, sound-only, and combo cues all function.
6. Favorites, tags, and search work in the library.
7. Background playback works where platform permits, with limitations documented.
8. Export/import preserves routine name, tags, cues, and settings.

## Testing Requirements
Unit tests are required for pure logic, including:
- time parsing
- time formatting
- countdown normalization
- duplicate timestamp detection
- duration and cue count limit validation
- warning/error separation
- scheduling math
- pause/resume shift calculations

## Definition of Done
The MVP is complete when:
- the app runs with `npm install` and `npx expo start`
- all required screens and controls are implemented
- offline local persistence works
- playback works with TTS/sound/combo actions
- heads-up, pause/resume, skip, and replay follow spec
- export/import works with versioned JSON
- bundled sound assets are included in repo
- README documents setup, features, and limitations
- unit tests cover core pure logic
- scope remains limited to the MVP and excludes listed non-goals
