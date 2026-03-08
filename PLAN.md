# Cue Builder - Sequential Codex Build Plan

This plan now reflects the current repository state.

- Steps 1-21 preserve the existing baseline that is already implemented in the repo. Their names and prompts have been updated to match the code that exists today.
- Steps 22+ define the next phase of work: preset foundation.
- When using this file with Codex for new work, start at the first unfinished step unless you are intentionally revisiting an earlier baseline area.

## How to Use
- Run one step at a time.
- Review the code after each step before moving to the next step.
- Preserve existing behavior unless the current step explicitly changes it.
- Keep scope limited to the current phase of the plan.
- Require TypeScript throughout.
- Keep the repo runnable with `npm install` and `npx expo start`.

---

## Step 1 - Preserve the Expo TypeScript app scaffold

```text
Preserve the existing Expo React Native TypeScript single-app setup. Keep the current root entry files (`App.tsx`, `index.ts`), npm scripts, README startup path, `src/` layout, `tests/` folder, and `assets/sounds/` folder. Do not re-bootstrap or replace the app scaffold unless the task explicitly requires it.
```

## Step 2 - Preserve and extend the current dependency and navigation wiring

```text
Work with the existing Expo-friendly dependency set: React Navigation, AsyncStorage, Expo Audio, Expo Speech, Expo Haptics, Expo Document Picker, Expo File System, Expo Sharing, and Expo Asset. Keep the root stack navigation for Library, Routine Editor, Playback, and Presets. Ensure dependency changes remain Expo-compatible and do not break `npx expo start`.
```

## Step 3 - Preserve the current domain model and constants

```text
Keep the domain model aligned with the current repo, not the earlier draft schema. The routine model includes: `id`, `name`, `tags`, `favorite`, `routineDurationMs`, `startDelayMs`, `headsUpEnabled`, `headsUpLeadTimeMs`, `hapticsEnabled`, `duckPlannedFlag`, and `cues[]`. The cue model includes: `id`, `offsetMs`, `actionType`, optional `ttsText`, optional `soundId`, `headsUpOverride`, and optional `headsUpLeadTimeMs`. Preserve the current constants for max routine duration, max cue count, playback tick target, default start delay, default heads-up lead time, and sound ids.
```

## Step 4 - Preserve and extend the current time and editor input utilities

```text
Work with the existing pure TypeScript utilities for parsing and formatting `mm:ss` and `hh:mm:ss`, validating millisecond values, formatting editor settings input, formatting playback display values, and normalizing cue offsets. The current editor uses elapsed-offset entry only; do not reintroduce countdown mode unless a later plan step explicitly requires it. Keep common user-input failures as structured errors instead of thrown exceptions.
```

## Step 5 - Preserve the current routine validation rules

```text
Keep the pure validation layer for routines and cues. Preserve errors for missing duration, negative times, cue times outside duration, duplicate timestamps, duration above 2 hours, and cue count above 200. Preserve warnings for out-of-order cues and near-overlapping cues. Keep warning/error separation intact so save and import remain blocked only by errors.
```

## Step 6 - Preserve the versioned local storage services

```text
Keep the AsyncStorage-backed routine storage layer and its strict serialization rules. Preserve CRUD operations, favorite-toggle support, the storage key `@cue-builder/routines`, snapshot versioning, and duplicate-id protection for routines and cues. Do not add cloud sync or auth. Storage remains local-only and schema validation remains strict.
```

## Step 7 - Preserve the current Library screen behavior

```text
Maintain the Library screen as the local routine hub. It must continue to list routines with name, tags, and favorite state; support search across name and tags; support creating a new routine; expose JSON import/export; and show the preset entry plus custom-create action in the empty state. Keep the UI functional and direct.
```

## Step 8 - Preserve the reusable editor components

```text
Maintain the reusable editor UI components under `src/components/editor`, including labeled text fields, tag input, favorite toggle, routine settings section, cue row editor, action type selector, sound selector, heads-up override selector, and cue row actions. Keep the editor list-based and do not introduce a timeline UI.
```

## Step 9 - Preserve the current Routine Editor shell

```text
Keep the Routine Editor create/edit shell aligned with the current implementation. It supports routine name, tags, favorite, routine duration, start delay, heads-up toggle, heads-up lead time, haptics, duck flag, and cue rows with time input, action type, TTS text, sound selection, heads-up override, optional cue-specific lead time, preview, duplicate, delete, and collapse/expand behavior. Do not regress the create/edit experience.
```

## Step 10 - Preserve editor normalization, validation, and persistence

```text
Keep the Routine Editor connected to the current parsing, normalization, validation, and storage layers. Preserve inline field errors and warnings, save blocking on errors, save allowance on warnings, create/update flows, unsaved-change prompts, delete support, and the current `Play Saved Routine` behavior in edit mode. Continue to store normalized elapsed offsets in milliseconds.
```

## Step 11 - Preserve library/editor integration

```text
Maintain the full Library <-> Routine Editor flow. Users must continue to create routines, edit existing ones, toggle favorite, return to the library with updates reflected, and keep search behavior stable. Do not add advanced sorting, folders, or filters in this phase.
```

## Step 12 - Preserve bundled sound assets and media wrappers

```text
Keep the bundled `beep`, `chime`, and `whistle` assets under `assets/sounds` and preserve the media service wrapper API for sound playback, speech, and haptics. Playback logic should continue to rely on simple calls such as `playSound`, `speakText`, and `triggerHaptic`. Keep platform-specific behavior isolated behind the media service.
```

## Step 13 - Preserve the playback scheduling core

```text
Maintain the isolated playback scheduling and controller logic. Preserve system-time-based elapsed calculation, total paused time tracking, interval-based ticking, explicit fired tracking for cue and heads-up events, and drift-resistant event collection. Keep the current heads-up behavior: beep-only, default 1-second lead time, configurable routine lead time, optional cue-specific lead time when override is `on`, and no double-firing.
```

## Step 14 - Preserve the current playback control semantics

```text
Keep the exact control behavior for Start, Pause, Resume, Stop, Skip Next, and Replay Last. Preserve start delay handling, pause/resume shifting through accumulated paused time, skip-next immediate cue firing, and replay-last behavior that re-fires only the last cue action without replaying heads-up audio. Keep controller behavior covered by tests.
```

## Step 15 - Preserve the Playback screen

```text
Maintain the Playback screen as the main runtime UI for a saved routine. It must continue to show routine name, status, elapsed clock, next cue time/action, controls, and the upcoming cue list with current/fired cue highlighting. Keep the display synchronized with the playback controller state.
```

## Step 16 - Preserve playback launch flows from saved routines

```text
Keep the user flow from the Library and Routine Editor into Playback using persisted routine data. Playback should continue to load a saved routine by id and run against the normalized stored model. Do not introduce a separate preset-only playback path or bypass persistence for normal routine playback.
```

## Step 17 - Preserve the current JSON import/export flow

```text
Maintain the versioned JSON import/export system with the wrapper shape `{ "version": 1, "routine": { ... } }`. Keep OS-native share and file-picker flows, strict structure validation, duplicate-id checks, warning/error handling, and user-facing error messages for invalid or incompatible payloads. Keep everything local-only.
```

## Step 18 - Preserve best-effort background playback support

```text
Keep the current best-effort background playback setup based on Expo Audio configuration. Preserve honest handling of platform limitations and keep behavior documented in the README. Do not over-engineer background execution or introduce platform-specific scope beyond what Expo can reasonably support in this app.
```

## Step 19 - Preserve the original preset placeholder baseline

```text
Preserve the historical baseline that the library empty state exposes a preset entry point and the app includes a Presets screen route. This placeholder existed before the preset foundation work begins. Later steps may replace the placeholder screen with a real preset flow, but they should keep the entry point intuitive and avoid breaking the empty-state create path.
```

## Step 20 - Preserve README and manual QA coverage

```text
Keep the README focused on setup, feature overview, architecture summary, storage behavior, known limitations, background playback constraints, and manual QA guidance. When features change, update the README honestly rather than carrying stale claims forward.
```

## Step 21 - Preserve the current acceptance baseline and polish bar

```text
Treat the existing app as the baseline to preserve while adding new work. Keep persistence, playback ordering, pause/resume behavior, heads-up overrides, TTS/sound/combo cues, favorite/tags/search, background playback best-effort, and import/export fidelity intact. Clean up typing issues and dead code when touched, but do not expand scope casually.
```

---

## Step 22 - Define the preset domain model and generator contract

```text
Introduce the preset foundation as a first-class but local-only feature. Add TypeScript types for preset categories, preset metadata, configurable preset fields, preset preview data, and a generator contract that produces ordinary Cue Builder routine drafts. Presets must generate the same routine/cue model the app already stores and plays back. Do not create a second playback or storage model for presets.
```

## Step 23 - Build reusable preset generation primitives

```text
Create pure generator helpers that can be reused by many presets. Focus on a small set of foundations such as interval rounds, repeated work/rest blocks, counted cadence sequences, reminder cadence, and agenda timebox generation. Keep these helpers deterministic and unit-testable. The goal is to support many future presets without hardcoding each one as a unique one-off routine builder.
```

## Step 24 - Add the first local preset catalog and category metadata

```text
Create a local static preset catalog with category labels, titles, descriptions, tags, and preview summaries. Keep the initial catalog intentionally small but representative so the foundation is validated without attempting the full library yet. Use generator-backed presets rather than hand-authored raw routines wherever possible. Keep all preset definitions on-device and in-repo; no remote CMS or service.
```

## Step 25 - Replace the placeholder Presets screen with a real catalog flow

```text
Turn the current Presets route into a real preset catalog screen. Group or label presets by category, show enough metadata to help selection, and keep the UI consistent with the existing app. Ensure users can reach presets from the empty library state and from a visible entry point when routines already exist. Do not build advanced discovery features yet beyond what is needed for the preset foundation.
```

## Step 26 - Add preset configuration, preview, and validation

```text
Implement a lightweight preset configuration flow so each preset can collect only the fields it needs before generation. Reuse the app's existing time input conventions where practical. Show a human-readable preview of what the preset will generate, validate inputs before continuing, and keep the forms simple rather than building a generic form platform that is broader than needed.
```

## Step 27 - Generate editable routine drafts from presets

```text
When a user chooses a preset, generate a standard Cue Builder routine draft and hand it off to the Routine Editor for review and editing before save. Do not auto-save generated routines without review. Keep the editor as the single place where generated routines become normal saved routines, so validation, storage, and playback continue to run through the existing paths.
```

## Step 28 - Seed the foundation with a small representative preset set

```text
Add a limited first batch of presets that proves the foundation works across multiple use cases without attempting the full preset library. Favor a compact set such as one interval preset, one mindfulness/breathing preset, one productivity preset, and one agenda/timebox preset. Make sure each preset exercises the new generator contract and results in a useful editable routine.
```

## Step 29 - Add preset tests, documentation, and final preset-foundation polish

```text
Add unit tests for preset generators, configuration validation, and draft generation. Add focused UI or integration coverage where practical. Update the README and any contributor docs to describe the preset catalog, configuration flow, and limitations of the first preset phase. Finish with a regression pass to ensure existing routine creation, storage, import/export, and playback behavior still work after preset foundation lands.
```

---

## Guardrails for Every Step

Use these constraints every time you hand a step to Codex:

```text
Constraints:
- TypeScript only.
- React Native + Expo single-app repo.
- Preserve existing shipped behavior unless the current step intentionally changes it.
- Keep scope limited to the current phase of the plan.
- Presets must generate ordinary routines that use the existing storage, validation, and playback model.
- Do not create a separate preset-only runtime or storage format.
- No timeline editor.
- No cloud sync or auth.
- No external audio overlay/integration.
- No custom sound import.
- No paid services.
- No full preset expansion beyond the preset foundation steps in this plan.
- Keep the app runnable with `npm install` and `npx expo start`.
- Prefer small, reviewable changes.
- Show all files created or modified.
```

## Optional Stronger Step Suffix

Append this when Codex starts drifting:

```text
Do not add features that are not explicitly required. Do not rename core concepts without a strong reason. Keep storage local-only. Preserve existing functionality unless a change is required to satisfy the current task. For preset work, keep all definitions local and route generated output through the ordinary routine editor, validation, storage, and playback paths. If a platform limitation prevents full behavior, implement the best possible version and document the limitation instead of expanding scope.
```
