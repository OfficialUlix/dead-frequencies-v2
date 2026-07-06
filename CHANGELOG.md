# Dead Frequencies Recovery Node Changelog

## Current Direction

ULIX - Dead Frequencies is now an interactive corrupted transmission node, not a conventional album landing page.

The intended experience is:

- The visitor lands inside a dead signal machine.
- The first meaningful action is holding the central node.
- The machine progresses through `gate`, `sigmap`, `panel`, and `finale` states.
- Tracks are recovered as spatial transmission fragments, not browsed as a normal tracklist.
- Each fragment requires a deliberate hold action.
- Audio clips unlock automatically after fragment recovery.
- The final message, `WE REMAIN`, only appears after all six fragments are recovered and the final hold is completed.

## Core Files

- `index.html` - machine markup, transmission nodes, panel, and finale structure.
- `src/styles.css` - full-screen console layout, corrupted visual system, responsive behavior, iOS touch suppression, finale reveal.
- `src/main.js` - state machine, hold mechanics, audio clips, glitch text, drone/hum, finale progression.
- `audio/` - local MP3 clips used by the recovery system.

## Major Rebuild

Commit: `5e3790d Rebuild Dead Frequencies recovery node`

Rebuilt the previous landing-page style into a stateful recovery console:

- Replaced hero/section/page-scroll structure with one contained machine.
- Added `html`/`body` data-state control:
  - `gate`
  - `sigmap`
  - `panel`
  - `finale`
- Added central hold-to-begin node.
- Added six spatial transmission nodes.
- Added per-track hold-to-recover panel.
- Added recovered count and integrity progression:
  - `0%`, `18%`, `32%`, `49%`, `66%`, `84%`, `100%`
- Preserved the real SoundCloud EP link.
- Added canvas-based waveform/radial/spectrum/static visuals.

## Track Data And Copy

Updated the six track fragments to longer, clearer descriptions:

1. `STATIC SIGNALS` - first contact with collapse; outside noise matching inside noise.
2. `DROWN TONIGHT` - pressure, numbness, control loss, breathing through it.
3. `GHOST` - absence, memory, grief answering through static.
4. `NEON GRAVES` - dead cities, artificial light, nightlife as memory cemetery.
5. `LIGHT THE FIRE` - willpower returning, anger becoming warmth, survival becoming motion.
6. `WE REMAIN` - connection, loyalty, refusal to disappear.

## Audio Behavior

Recovered from the backup interaction model and refined:

- Removed manual `PLAY PREVIEW` button.
- Fragment recovery now automatically plays the matching local MP3 clip.
- Clips use explicit start/end timestamps.
- Current clip windows:
  - `STATIC SIGNALS`: `36s` to `69s`
  - `DROWN TONIGHT`: `82s` to `110s`
  - `GHOST`: `11s` to `31s`
  - `NEON GRAVES`: `90s` to `123s`
  - `LIGHT THE FIRE`: `36s` to `59s`
  - `WE REMAIN`: `101s` to `117s`
- Clips fade in/out through a Web Audio lowpass filter.
- Returning from a panel stops the active clip.
- The sixth clip does not immediately trigger the finale; finale starts only after returning from the recovered sixth panel.
- Added low-level ambient drone/hum after node activation.
- Drone ducks while song clips play and returns after clips stop.
- Replay stops clip and drone.

## Interaction And Glitch Fixes

- Holding the central node and fragment recovery buttons works on mouse, touch, and keyboard.
- Fragment text now animates with terminal-style glitching while unlocking, then resolves to readable text.
- Added tactile/glitch sounds during holds:
  - resistance pulses
  - glitch bursts
  - lock sound
- Added keyboard accessibility for hold actions via Enter/Space.
- Added `prefers-reduced-motion` handling, while still forcing critical finale text resolution to remain visible.

## Finale

The finale was refined to avoid feeling like a generic success screen.

Current finale flow:

1. `ALL SIGNALS DECODED` glitches in and resolves.
2. `RESIDUAL FREQUENCY DETECTED` glitches in and resolves.
3. User sees `HOLD TO STABILISE FINAL MESSAGE`.
4. Final hold completes.
5. `WE REMAIN` glitches in and resolves.

Final reveal includes:

- `WE REMAIN`
- `The signal is damaged. The message is not.`
- `100% INTEGRITY`
- faint recovered track/status ledger around the edges
- six recovered nodes collapsed into one central signal
- reduced static
- calmer/stable waveform behavior
- delayed CTAs

Removed:

- `FINAL MESSAGE PARTIAL`
- instant clean finale reveal
- immediate CTA appearance

## iPhone / Safari Fixes

Commits:

- `3ad0631 Fix iOS hold highlight`
- `553434a Refine mobile touch and finale resolve`
- `588113b Harden iOS touch and finale glitch`

Fixed iPhone Safari showing the default glassy highlight/selection overlay during long holds.

Implemented:

- global iOS tap-highlight suppression
- global iOS focus-ring suppression
- global iOS touch-callout suppression
- global iOS user-select suppression
- JS-level `touchstart`/`touchend` handling for long-hold controls
- dedicated touch handlers for:
  - central gate hold
  - fragment recovery hold
  - finale hold

Important: the strongest iOS fix is both CSS and JS. Do not remove `suppressTouchHighlight()` or the touch handlers in `bindHold()`.

## Deployment Notes

Repo:

- `https://github.com/OfficialUlix/dead-frequencies-v2.git`
- branch: `main`

Recent pushed commits:

- `588113b Harden iOS touch and finale glitch`
- `553434a Refine mobile touch and finale resolve`
- `3ad0631 Fix iOS hold highlight`
- `5e3790d Rebuild Dead Frequencies recovery node`

Recommended hosting:

- Cloudflare Pages can deploy this as a static site directly from GitHub.
- Vercel can also deploy it as a static/no-framework project.
- Domain goal: `www.iamulix.com`.

## Known Workspace Notes

Untracked local items have intentionally not been committed unless explicitly needed:

- `.gitignore`
- `.omc/`
- `CONCEPT_V2.md`
- `music/`

The deployed site currently depends on the committed static files and `audio/` assets.
