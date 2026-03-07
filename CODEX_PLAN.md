# Cue Builder — Sequential Codex Build Plan

This file is meant to be used manually, step by step, with Codex. Each prompt assumes the previous one has already been completed and reviewed. The prompts are intentionally scoped to reduce drift and keep implementation aligned with the MVP.

## How to Use
- Run one prompt at a time.
- Review the code after each step before moving to the next prompt.
- Keep scope limited to the MVP.
- Do not let Codex invent extra features.
- Require TypeScript throughout.
- Keep the repo runnable with `npm install` and `npx expo start`.

---

## Prompt 1 — Initialize the Expo TypeScript app

```text
Create a production-oriented Expo React Native app in TypeScript for a project called “Cue Builder”. Use a single-app repo. Set up the base folder structure for src/components, src/screens, src/navigation, src/services, src/utils, src/types, src/constants, src/hooks, tests, and assets/sounds. Configure package.json scripts so the project runs with `npm install` and `npx expo start`. Add a minimal App.tsx entry point and a basic README with startup instructions. Do not add extra features.
```

## Prompt 2 — Install and wire core dependencies

```text
Add and configure the core dependencies for this Expo TypeScript app: React Navigation, AsyncStorage, and any Expo modules needed for audio playback, file import/export, sharing, haptics, and speech/TTS support. Keep choices Expo-friendly. Set up navigation with a root stack for Library, Routine Editor, Playback, and a simple Presets Coming Soon placeholder screen. Ensure the app still runs after dependency setup.
```

## Prompt 3 — Define domain types and constants

```text
Create the TypeScript domain model for Cue Builder. Add types for Routine, Cue, CueActionType, CueInputMode, HeadsUpOverride, export wrapper versioning, validation results, and playback state. Add constants for max routine duration (2 hours), max cue count (200), tick interval target, and sound IDs (beep/chime/whistle). Keep the model aligned with this schema: routine has id, name, tags, favorite, routineDurationMs, defaultHeadsUpEnabled, hapticsEnabled, duckPlannedFlag, and cues[]; cue has id, offsetMs, inputMode, actionType, ttsText or soundId, and headsUpOverride.
```

## Prompt 4 — Build time parsing and normalization utilities

```text
Implement pure utility functions in TypeScript for parsing and formatting cue times. Support `mm:ss` and `hh:mm:ss`. Add conversion logic for elapsed and countdown entry modes. Countdown must require routineDurationMs and convert using `elapsedOffsetMs = routineDurationMs - remainingMs`. Validate that converted values fall within [0, routineDurationMs]. Return clean error objects rather than throwing for common user-input cases. Add unit tests for parsing, formatting, countdown conversion, and edge cases.
```

## Prompt 5 — Build routine validation logic

```text
Implement pure validation logic for routines and cues. Enforce errors for negative times, duplicate timestamps, duration over 2 hours, cue count over 200, missing required routine duration, and invalid countdown conversions. Return warnings—not errors—for overlaps and out-of-order cues. Save should be blockable on errors only. Add unit tests covering all validation rules and warnings-vs-errors behavior.
```

## Prompt 6 — Create local storage services

```text
Implement an AsyncStorage-backed storage layer for routines. Add create, read, update, delete, list, and favorite-toggle support. Store everything locally only. Include data migration handling for a versioned wrapper if helpful, but do not add cloud sync or auth. Add lightweight tests for serialization/deserialization helpers where practical.
```

## Prompt 7 — Create the Library screen

```text
Build the Library screen. It must show all saved routines with name, tags, and favorite star. Add a simple search bar that searches name plus tags. Add a “New Routine” button. Add import/export entry points. For empty state, show two buttons: “Start with a preset” leading to a placeholder screen/message saying “Presets coming soon”, and “Create custom routine”. Keep the UI functional and simple.
```

## Prompt 8 — Create reusable editor row components

```text
Build reusable UI components for the routine editor: text input fields, tag input, favorite toggle, routine settings section, cue row editor, action type selector, sound selector, heads-up override selector, and row action controls for reorder/duplicate/delete. Keep the cue editor table/list based only—do not add a timeline view.
```

## Prompt 9 — Build the Routine Editor screen shell

```text
Create the Routine Editor screen for creating and editing routines. Add fields for name, tags, favorite, routine duration, default heads-up, haptics, and duck flag labeled as planned/no-op. Add a cues list editor using the reusable row components. Each cue row must support time input, entry mode (elapsed/countdown), action type (tts/sound/combo), content fields, heads-up override, reorder, duplicate, and delete. Add an “Add Cue” action. Do not implement save yet beyond local component state.
```

## Prompt 10 — Connect editor state, normalization, and validation

```text
Wire the Routine Editor screen to the parsing, normalization, and validation utilities. Internally normalize all cue times to elapsed offsets in milliseconds. Show inline warnings and errors on cue rows and routine-level fields. Disable Save when errors exist. Allow Save when only warnings exist. Persist saved routines using the AsyncStorage service. Support editing existing routines as well as creating new ones.
```

## Prompt 11 — Add routine row actions and library integration

```text
Connect the Library and Routine Editor flows fully. From the Library, users must be able to create a new routine, open an existing routine for editing, toggle favorite, and see updates reflected immediately after saving. Keep the search over name and tags working. Do not add extra filters or sorting beyond what the MVP requires.
```

## Prompt 12 — Add bundled sound assets and media wrappers

```text
Add bundled sound assets for beep, chime, and whistle under assets/sounds and wire them into the app. Create a media service wrapper that can play those sound effects, trigger system speech/TTS in English, and trigger haptics/vibration when requested. Keep the API simple so playback logic can call `playSound`, `speakText`, and `triggerHaptic`. Document any platform constraints in code comments where relevant.
```

## Prompt 13 — Implement playback scheduling core

```text
Implement the playback engine as isolated logic plus a React-friendly controller. Minimize drift by tracking routineStartTime, computing elapsed from system time, tracking totalPausedMs, and using a short interval tick between 100 and 250ms. Do not use one timeout per cue. Add explicit fired tracking for cues and heads-up events so nothing double-fires. Support heads-up ping at t-3s, cue execution at cue time, and optional haptics at cue time. Add unit tests for scheduling math and fired-state handling.
```

## Prompt 14 — Implement playback control semantics exactly

```text
Complete the playback control logic with exact behavior for Start, Pause, Resume, Stop, Skip to Next Cue, and Replay Last Cue. Pause/resume must shift remaining cues later by the paused duration so the timeline continues from “now”. Skip to Next Cue must immediately jump to the next cue and fire its action. Replay Last Cue must immediately re-fire the last executed cue action and must not replay heads-up. Add unit tests for pause shift, skip-next behavior, and replay-last behavior.
```

## Prompt 15 — Build the Playback screen

```text
Create the Playback screen or integrated playback panel using the playback engine. Show routine name, elapsed clock, next cue time/action, and an upcoming cues list with the current cue highlighted. Add controls for Start, Pause, Resume, Stop, Skip Next, and Replay Last. Ensure the screen reflects current playback state accurately.
```

## Prompt 16 — Connect library/editor to playback flow

```text
Add the user flow from the Library and/or Routine Editor into Playback so a saved routine can be launched cleanly. Ensure playback uses the persisted normalized data model. Keep the UX straightforward and avoid adding extra screens or options.
```

## Prompt 17 — Add import/export JSON support

```text
Implement routine export/import using a versioned JSON format and OS-native share/file-picker flows. Export shape must be `{ "version": 1, "routine": { ... } }`. Import must validate the structure before saving. Audio files are not part of export. Add clear user-facing error handling for invalid JSON or incompatible structure. Keep everything local-only.
```

## Prompt 18 — Add best-effort background playback support

```text
Implement best-effort background playback for Expo as far as the platform allows. Use Expo-supported configuration, config plugins, or a custom dev client only if needed. Do not over-engineer or expand scope. Document clearly in the README what works on iOS and Android, especially for screen-off and backgrounded playback limitations.
```

## Prompt 19 — Add the placeholder preset entry

```text
Ensure the empty library state includes a “Start with a preset” button that opens a simple placeholder screen or message saying “Presets coming soon”. Do not implement an actual preset library. Also ensure “Create custom routine” is available from the same empty state.
```

## Prompt 20 — Finalize README and manual QA checklist

```text
Write a thorough README for the Cue Builder app. Include setup and run commands, feature overview, architecture summary, local storage behavior, known limitations, and honest notes about background playback constraints on iOS and Android. Add a manual QA checklist covering audio cues, TTS, heads-up behavior, pause/resume, skip/replay, persistence, import/export, and background behavior.
```

## Prompt 21 — Final polish and acceptance pass

```text
Review the app against the acceptance criteria and tighten the implementation without adding new scope. Verify that the app supports: persisted routines after restart, accurate cue order, pause/resume shift, heads-up overrides, TTS-only/sound-only/combo cues, favorite/tags/search, background playback best-effort, and export/import fidelity. Clean up typing issues, remove dead code, and make sure the final repo runs with `npm install` and `npx expo start`.
```

---

## Guardrails for Every Prompt

Use these constraints every time you hand a step to Codex:

```text
Constraints:
- TypeScript only.
- React Native + Expo single-app repo.
- Keep scope strictly within the MVP.
- No timeline editor.
- No cloud sync or auth.
- No preset library beyond placeholder.
- No external audio overlay/integration.
- No custom sound import.
- No paid services.
- Keep the app runnable with `npm install` and `npx expo start`.
- Prefer small, reviewable changes.
- Show all files created or modified.
```

## Optional Stronger Prompt Suffix

Append this when Codex starts drifting:

```text
Do not add features that are not explicitly required. Do not rename core concepts. Keep storage local-only. Preserve existing functionality unless a change is required to satisfy the current task. If a platform limitation prevents full behavior, implement the best possible version and document the limitation instead of expanding scope.
```
