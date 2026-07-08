# Suno Soundtrack Prompt Plan: Zombie Invasion

## Summary

Create a 15-track prompt outline for **Zombie Invasion**, optimized for immediate
Suno generation. The soundtrack direction is **instrumental, gritty low-poly
zombie village defense**, with loopable cues that support a first-person survival
game without overwhelming combat readability.

The current game uses menu, safe house, shop/intermission, adaptive raid pressure,
boss, victory, and game-over music states. This plan expands those states into a
full prompt package that can be generated, auditioned, and later mapped back to
runtime cues.

## Prompt Template

Each Suno prompt follows this structure:

`Instrumental seamless loop, gritty low-poly zombie village defense game music, [scene mood], [instrument palette], [tempo/energy], [texture], no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits, non-distracting background music, clean loop ending`

## Creative Defaults

- Instrument palette: detuned electric guitar harmonics, muted bass, dusty
  analog synth pads, low piano, sparse toms, metal taps, bowed cymbal swells,
  distant siren-like textures, and restrained horror ambience.
- Tempo: mostly 74-102 BPM; combat cues can push to 108-122 BPM while staying
  steady and loop-friendly.
- Safe cues: tense but breathable, using minor-key warmth, soft pulse, and
  low-volume ambience rather than full horror stings.
- Danger cues: darker harmony, close-mic percussion, bass ostinatos, pulsing
  synths, and zombie-horde pressure without sudden jump scares.
- Looping: every cue should work as a seamless gameplay loop unless noted as a
  sting.

## Track Set

### 1. Title / Main Menu

- **Mode / Use Case:** Main menu before starting a run.
- **Music Role:** Establish the village-under-siege identity with dread,
  resolve, and a faint survival-action pulse.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, ominous but playable main menu mood, detuned electric
  guitar harmonics, low piano notes, dusty analog synth pad, muted bass pulse,
  sparse metal taps, 82 BPM, foggy nighttime texture with distant wind and
  restrained tension, no vocals, no lyrics, no harsh dubstep, no EDM drop, no
  cinematic trailer hits, non-distracting background music, clean loop ending
- **Notes:** Replacement candidate for `menu_theme`; should feel like the player
  is choosing to enter a dangerous night, not watching a movie trailer.

### 2. Safe House / Wake-Up Start

- **Mode / Use Case:** Opening safe house, first orientation, and start-mission
  moment.
- **Music Role:** Quiet preparation cue that gives the player room to read HUD
  and controls.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, cautious safe house preparation mood, soft palm-muted
  guitar, warm sub bass, ticking clock percussion, distant fluorescent hum,
  brushed snare taps, 76 BPM, close interior texture with muffled horde ambience
  outside, no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic
  trailer hits, non-distracting background music, clean loop ending
- **Notes:** Replacement candidate for `safe_house_intro`; keep transients soft
  so tutorial prompts remain readable.

### 3. Village Patrol / Low Threat Raid

- **Mode / Use Case:** Early waves, few enemies alive, player scouting lanes.
- **Music Role:** Baseline raid loop with forward motion but low stress.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, wary village patrol mood, muted electric guitar ostinato,
  rounded synth bass, soft floor tom pulse, low strings pad, subtle chain rattle,
  88 BPM, moonlit open-air texture with steady survival tension, no vocals, no
  lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits,
  non-distracting background music, clean loop ending
- **Notes:** Replacement candidate for `raid_low`; should sustain long play
  sessions without fatigue.

### 4. Lane Defense / Medium Threat Raid

- **Mode / Use Case:** More active combat, multiple enemies closing, village HP
  pressure rising.
- **Music Role:** Escalate urgency while preserving aim and movement clarity.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, focused lane defense mood, pulsing analog bass, chugging
  muted guitar, low toms, tight metal clicks, thin alarm-like synth motif, 102
  BPM, tense dry texture with controlled horde pressure, no vocals, no lyrics, no
  harsh dubstep, no EDM drop, no cinematic trailer hits, non-distracting
  background music, clean loop ending
- **Notes:** Replacement candidate for `raid_mid`; avoid busy high-frequency
  percussion that masks gunfire or hit feedback.

### 5. Horde Breach / High Threat Raid

- **Mode / Use Case:** Heavy crowd pressure, close threats, recent player or
  village damage.
- **Music Role:** Highest regular raid intensity without becoming a boss theme.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, horde breach panic held under control, driving low synth
  ostinato, distorted bass guitar, tribal floor toms, scraped metal rhythm,
  dissonant piano hits, 116 BPM, claustrophobic texture with surging undead
  pressure and no jump scares, no vocals, no lyrics, no harsh dubstep, no EDM
  drop, no cinematic trailer hits, non-distracting background music, clean loop
  ending
- **Notes:** Replacement candidate for `raid_high`; intense enough for crisis,
  still loopable for several minutes.

### 6. Shop / Intermission

- **Mode / Use Case:** Wave-clear summary, buying gear, reviewing goals and
  upgrades.
- **Music Role:** Relief cue that still reminds the player the night is not over.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, exhausted shop intermission mood, clean electric guitar
  arpeggios, warm upright-style bass, soft kick heartbeat, dusty keyboard chords,
  light tool-bench percussion, 84 BPM, sheltered workshop texture with distant
  undead groans far outside, no vocals, no lyrics, no harsh dubstep, no EDM drop,
  no cinematic trailer hits, non-distracting background music, clean loop ending
- **Notes:** Replacement candidate for `shop_intermission`; should make
  progression feel useful rather than safe.

### 7. Weapon Upgrade / Loadout Focus

- **Mode / Use Case:** Weapon purchases, armor decisions, ordnance selection,
  and pre-wave loadout tuning.
- **Music Role:** Tactile planning cue with a mechanical workbench identity.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, tactical loadout focus mood, muted bass riff, soft
  industrial percussion from tools and shell casings, close electric piano,
  filtered synth pad, restrained hi-hat tick, 92 BPM, dry workshop texture with
  small metallic details, no vocals, no lyrics, no harsh dubstep, no EDM drop, no
  cinematic trailer hits, non-distracting background music, clean loop ending
- **Notes:** Optional expansion cue if shop and summary are later split into
  separate UI states.

### 8. Village Rescue / Escort

- **Mode / Use Case:** Finding villagers in buildings and escorting them back to
  Town Hall.
- **Music Role:** Add human stakes and motion without breaking the survival tone.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, urgent village rescue mood, tremolo guitar, low cello-like
  synth pad, cautious snare brush, soft bass pulse, fragile music-box accent, 96
  BPM, hopeful but threatened texture with footsteps through empty streets, no
  vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits,
  non-distracting background music, clean loop ending
- **Notes:** Use when the escort flow becomes prominent enough to deserve its
  own adaptive layer.

### 9. Building Interior / Door Search

- **Mode / Use Case:** Entering houses, checking doors, locating villagers, and
  close-quarters search.
- **Music Role:** Tighten tension and reduce musical density for indoor spatial
  awareness.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, abandoned building search mood, sub bass drone, prepared
  piano plucks, faint bowing metal, distant pipe creaks, minimal brushed
  percussion, 78 BPM, dusty interior texture with heavy silence between pulses,
  no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits,
  non-distracting background music, clean loop ending
- **Notes:** Distinct from safe house by feeling unsafe, hollow, and close.

### 10. Night Ambient Bed

- **Mode / Use Case:** Low-intensity night traversal, ambience layer, or moments
  between wave beats.
- **Music Role:** Provide mood without implying immediate combat.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, lonely night survival ambience, very soft analog drone,
  sparse guitar harmonics, distant thunderless wind, low heartbeat bass every few
  bars, faint insect bed, 74 BPM, wide cold outdoor texture with minimal melody,
  no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits,
  non-distracting background music, clean loop ending
- **Notes:** Could replace or augment the current night ambient bed.

### 11. Special Infected Encounter

- **Mode / Use Case:** First appearance of leapers, flyers, brutes, crawlers, or
  other behavior-changing enemy types.
- **Music Role:** Signal novelty and danger without stealing attention from the
  enemy intro prompt.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, strange special infected encounter mood, unstable synth
  pulse, warped guitar slides, low frame drum, brittle percussion clicks,
  dissonant two-note motif, 104 BPM, mutated texture with stalking movement and
  restrained horror color, no vocals, no lyrics, no harsh dubstep, no EDM drop,
  no cinematic trailer hits, non-distracting background music, clean loop ending
- **Notes:** Keep the motif short enough that it can layer or swap quickly.

### 12. Village Under Attack

- **Mode / Use Case:** Village is taking damage, enemies are biting structures,
  or integrity is critically low.
- **Music Role:** Redirect player priority toward defense.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, village under attack alarm mood, low siren synth swell,
  urgent tom pattern, distorted bass pedal tone, hammered piano octave,
  rattling chain percussion, 110 BPM, smoke-filled texture with desperate defense
  pressure, no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic
  trailer hits, non-distracting background music, clean loop ending
- **Notes:** Best used as an adaptive layer or alternate high-threat cue rather
  than a full replacement for every intense moment.

### 13. Boss Battle / Mega Zombie

- **Mode / Use Case:** Mega zombie, secret boss, or final wave boss state.
- **Music Role:** Big threat identity with a clear loop and stable rhythm.
- **Suno Prompt:** Instrumental seamless loop, gritty low-poly zombie village
  defense game music, massive boss battle mood, heavy distorted bass guitar,
  pounding cinematic low toms kept dry, growling analog synth brass, minor piano
  stabs, scraped metal swells, 122 BPM, towering undead texture with relentless
  forward drive and no trailer hits, no vocals, no lyrics, no harsh dubstep, no
  EDM drop, non-distracting background music, clean loop ending
- **Notes:** Replacement candidate for `boss_battle`; should feel heavier than
  `raid_high` but still leave room for weapon SFX.

### 14. Game Over / Village Lost Sting

- **Mode / Use Case:** Defeat, player death, village collapse.
- **Music Role:** Short failure cue, not a full loop.
- **Suno Prompt:** Instrumental short sting, gritty low-poly zombie village
  defense game music, bleak village lost mood, low piano descent, distant broken
  siren, bowed cymbal fade, sub bass thud, sparse guitar harmonic, slow and
  final, smoky texture with exhausted silence, no vocals, no lyrics, no harsh
  dubstep, no EDM drop, no cinematic trailer hits, clean natural ending
- **Notes:** Replacement candidate for `game_over_sting`; generate as a short
  non-looping sting if Suno allows, otherwise trim after export.

### 15. Victory / Dawn Holdout

- **Mode / Use Case:** Boss defeated, run won, dawn after surviving the night.
- **Music Role:** Resolution cue with relief but not triumphant fantasy fanfare.
- **Suno Prompt:** Instrumental short resolution cue or seamless loop, gritty
  low-poly zombie village defense game music, weary dawn victory mood, clean
  electric guitar chords, warm bass, soft tom heartbeat, airy analog pad, gentle
  piano motif, 86 BPM, first-light texture with smoke clearing over the village,
  no vocals, no lyrics, no harsh dubstep, no EDM drop, no cinematic trailer hits,
  non-distracting background music, clean loop ending if looped
- **Notes:** Replacement candidate for `victory_sting`; can be generated as a
  short win sting or an extended post-run results loop.

## Review Criteria

The final generated tracks should be:

- Paste-ready from this document into Suno.
- Distinct across all 15 gameplay modes.
- Tense enough for zombie survival while still calm enough for repeated play.
- Clear about which scene, activity, or adaptive state each cue supports.
- Cohesive with Zombie Invasion's low-poly village defense identity.
- Free of sudden jump-scare transients that would fight weapon, hit, and UI SFX.
