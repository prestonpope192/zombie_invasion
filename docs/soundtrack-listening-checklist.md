# Soundtrack Listening Checklist

Use this after importing generated music to make the remaining ear-review calls
without re-reading code or asset notes.

## Current Runtime Cue Order

| Order | Runtime moment | Active file | Source render | Decision focus |
|---|---|---|---|---|
| 1 | Title / main menu | `public/audio/music/menu_theme.mp3` | `Zombie Invasion - Title Main Menu.m4a` | Establishes the game mood without feeling too intense before play starts. |
| 2 | Safe house / wake-up start | `public/audio/music/safe_house_intro.mp3` | `Zombie Invasion - Safe House Wake-Up Start.m4a` | Should feel tense but quiet enough for orientation and early setup. |
| 3 | Shop / intermission | `public/audio/music/shop_intermission.mp3` | `Zombie Invasion - Shop Intermission.m4a` | Should reset pressure between raids and stay readable under UI clicks. |
| 4 | Low raid pressure | `public/audio/music/raid_low.mp3` | `Zombie Invasion - Lane Defense Medium Threat Raid.m4a` | This intentionally uses the medium-threat render for low pressure; confirm it is not too aggressive for wave 1. |
| 5 | Mid raid pressure | `public/audio/music/raid_mid.mp3` | `Zombie Invasion - Horde Breach High Threat Raid.m4a` | This intentionally uses the high-threat render for mid pressure; confirm the escalation is strong but not abrupt. |
| 6 | High raid pressure | `public/audio/music/raid_high.mp3` | `Zombie Invasion - Boss Battle Mega Zombie.m4a` | This intentionally shares the boss render; confirm it is not fatiguing before the boss state. |
| 7 | Boss battle | `public/audio/music/boss_battle.mp3` | `Zombie Invasion - Boss Battle Mega Zombie.m4a` | Should clearly feel like the peak encounter and still loop cleanly. |
| 8 | Victory | `public/audio/music/victory_sting.mp3` | `Zombie Invasion - Victory Dawn Holdout.m4a` | Should resolve the run without sounding like a new raid loop. |
| 9 | Game over | `public/audio/music/game_over_sting.mp3` | `Zombie Invasion - Game Over Village Lost Sting.m4a` | Should land quickly and clearly without overstaying. |

## Reference-Only Files

| File | Source render | Use |
|---|---|---|
| `public/audio/music/main_motif.mp3` | `Zombie Invasion - Main Melodic Motif.m4a` | Reference only. Do not wire directly unless the soundtrack direction changes. |
| `public/audio/music/shop_intermission_alt.mp3` | `Zombie Invasion - Shop Intermission_1.m4a` | Alternate shop candidate. Compare against the active shop cue before swapping. |

## Listening Pass

1. Play each runtime cue in the order above.
2. For loops, listen through the first loop boundary and the first five seconds
   after it repeats.
3. During raid cues, listen with weapon fire and UI sounds in mind; the cue
   should not mask gameplay feedback.
4. Compare `shop_intermission.mp3` and `shop_intermission_alt.mp3`; choose the
   calmer, less repetitive option.
5. Compare `raid_high.mp3` and `boss_battle.mp3` in context. They are currently
   the same render by request, so the key question is whether using boss energy
   for high raid pressure makes late waves tiring.

## Pass Criteria

- No vocals or lyric-like phrases are prominent enough to distract from play.
- No click, pop, hard cutoff, or obvious volume jump at the loop boundary.
- Each raid pressure band feels distinct in intensity from the previous band.
- The shop cue reduces stress compared with raid music.
- Victory and game-over cues read as end-state stings, not general background
  loops.
- The boss/high-threat shared render feels acceptable for repeated gameplay.

## If A Swap Is Chosen

For a shop alternate swap, replace the active file with the alternate render,
then rerun the audio asset tests and PlayCanvas smoke:

```sh
cp public/audio/music/shop_intermission_alt.mp3 public/audio/music/shop_intermission.mp3
npm test
npm run smoke:playcanvas
```

For a high-threat or boss split, add or replace the chosen MP3, update
`src/fps/assets/ASSETS.md`, and keep `test/music_assets.test.js` aligned with
the intended mapping.
