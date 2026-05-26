# Zombie Invasion FPS Playtest Notes

Date: 2026-04-23

Local run:

- Started the Vite dev server with `npm run dev -- --host 127.0.0.1 --port 5173`
- Opened the game locally in Arc at `http://127.0.0.1:5173/`
- Played through boot and the opening raid state

## Fast read

What feels good:

- The main menu has a strong tone and a clear visual identity.
- The core HUD language is coherent: health, stamina, village HP, weapon card, and minimap all read like the same game.
- The atmosphere is already there. The village silhouettes and night palette land immediately.

What felt off in the first few minutes:

- The game starts in active defense immediately, but nearby prompts still make it feel like the player is in a pre-combat tutorial state.
- The desktop HUD spends too much of the opening minute teaching controls in-place instead of getting out of the way.
- Early combat readability is fighting the darkness, the heavy chrome, and the onboarding mismatch at the same time.

## Key findings

### 1. The opening prompt and the actual run state disagree

Observed in the live run:

- After clicking `START MISSION`, I spawned into an active raid with `Wave 1`, enemy count, grenade count, and a nearby `Open Safe House` prompt.
- While still orienting on that prompt, the run progressed and eventually failed.

Code evidence:

- [`src/fps/app/FpsGame.js`](/Users/preston/Code/zombie_invasion/src/fps/app/FpsGame.js:243) sends `startRaidRun()` straight into `raidScene.enter()`.
- [`src/fps/scenes/RaidScene3D.js`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:4324) calls `resetRun()` on enter.
- [`resetRun()`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:4460) sets `startHouseExited = true`, `phase = GAME_PHASE.DEFENSE`, and calls `waveDirector.startWave(0)`.
- That means the player is already in wave defense before they have taken any explicit onboarding action.

Why it matters:

- The UI is implying "learn the space first" while the game logic is already saying "the run has started."
- That makes early deaths feel unfair even if the raw balance is technically correct.

### 2. The desktop HUD is too tutorial-heavy during live play

Observed in the live run:

- The always-on controls line occupies a meaningful chunk of the top-left view during normal gameplay.
- It competes with the actually important signals: prompt, wave state, enemy count, and the scene itself.

Code evidence:

- [`src/fps/scenes/RaidScene3D.js`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:7265) renders a full desktop controls string.
- [`src/fps/scenes/RaidScene3D.js`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:7270) keeps it visible on desktop all the time via `inline-block`.

Why it matters:

- New players need help, but persistent help text is not the same thing as good onboarding.
- The opening view should sell threat, space, and intention first.

### 3. Readability pressure is stacked too early

Observed in the live run:

- The night mood is good, but the opening minute asks the player to parse dark geometry, a large HUD footprint, a safe-house prompt, wave pressure, and a melee-only loadout at the same time.
- The result is tension without enough early comprehension.

Related data:

- The default save starts with only the pipe equipped and owned in [`src/fps/systems/saveFps.js`](/Users/preston/Code/zombie_invasion/src/fps/systems/saveFps.js:10).
- Wave 1 already has 8 enemies in [`src/fps/config/waves_fps.json`](/Users/preston/Code/zombie_invasion/src/fps/config/waves_fps.json:2).

Why it matters:

- The current first minute pushes challenge before confidence.
- That is usually the wrong order unless the game is intentionally built around immediate mastery checks.

## Draft PR proposals

### PR 1. Convert the opener into a real playable cold open

Working title:

- `Make wave start explicit and gate combat behind the first exit`

Goal:

- Align the player's first 30-45 seconds with what the UI currently implies.

Scope:

- Spawn the player inside the start house or in a true no-pressure prep state.
- Do not call `waveDirector.startWave(0)` until the player exits the house or confirms `Start Wave 1`.
- Replace the generic safe-house prompt with a single objective banner:
  - `Leave the safe house`
  - `Reach the village perimeter`
  - `Wave 1 begins`
- Add a short grace window before zombies can damage the player or village.

Primary files:

- [`src/fps/scenes/RaidScene3D.js`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:4324)
- [`src/fps/app/FpsGame.js`](/Users/preston/Code/zombie_invasion/src/fps/app/FpsGame.js:243)
- [`test`](/Users/preston/Code/zombie_invasion/test)

Expected outcome:

- First deaths feel earned instead of premature.
- The first mission reads as authored, not just spawned.

### PR 2. Replace the persistent desktop help slab with contextual onboarding

Working title:

- `Collapse desktop HUD help into contextual prompts and fade-outs`

Goal:

- Keep the same information, but only show it when it helps.

Scope:

- Replace the full controls sentence with 2-4 short contextual hints.
- Fade hints after the player successfully performs the verb once.
- Move the long-form control list behind the existing help affordance.
- Keep the objective prompt line visible, but make the controls line dismissible or transient.

Primary files:

- [`src/fps/scenes/RaidScene3D.js`](/Users/preston/Code/zombie_invasion/src/fps/scenes/RaidScene3D.js:7220)
- [`index.html`](/Users/preston/Code/zombie_invasion/index.html:1)

Expected outcome:

- Better first-look screenshots.
- Less HUD competition during actual combat.

### PR 3. Rebalance wave 1 around clarity, not just survival math

Working title:

- `Retune the first two waves for confidence-building combat`

Goal:

- Make the first successful run teach the loop, not just punish hesitation.

Scope:

- Reduce opening pressure slightly: fewer simultaneous threats, clearer spawn funnel, stronger early audio and visual telegraphing.
- Consider giving the player the pistol from the start and leaving the pipe as emergency or secondary flavor.
- Push the first rescue or first upgrade moment earlier so the player sees the full loop sooner.
- Tune early zombie silhouettes and prompting around whatever direction the game chooses.

Primary files:

- [`src/fps/config/waves_fps.json`](/Users/preston/Code/zombie_invasion/src/fps/config/waves_fps.json:1)
- [`src/fps/systems/saveFps.js`](/Users/preston/Code/zombie_invasion/src/fps/systems/saveFps.js:10)
- [`src/fps/config/economy_fps.json`](/Users/preston/Code/zombie_invasion/src/fps/config/economy_fps.json:1)
- [`src/fps/config/weapons_fps.json`](/Users/preston/Code/zombie_invasion/src/fps/config/weapons_fps.json:1)

Expected outcome:

- More players reach the first intermission and understand the shop and progression loop.

## Strategic improvement threads

### Thread A. Lean harder into arcade defense

If the goal is a fast, replayable, `one more run` action game:

- Start outside with momentum, but remove any misleading tutorial prompts.
- Push bolder silhouettes, brighter threat telegraphs, and more immediate weapon satisfaction.
- Keep runs short and legible.
- Use the shop as a tempo break, not a systems wall.

This version should feel closer to:

- pick up instantly
- survive by movement and target priority
- upgrade into spectacle fast

### Thread B. Lean harder into village survival

If the goal is a more authored defense-and-rescue loop:

- Make the safe house real.
- Turn the opening into a setup phase.
- Emphasize villager rescue, building access, and town defense choices.
- Let pacing breathe between combat spikes.

This version should feel closer to:

- prepare
- defend
- rescue
- rebuild

## Recommendation

If only one thing gets done first, do PR 1.

The current project already has atmosphere and a workable loop. The biggest immediate gain is not more content. It is making the first minute honest.
