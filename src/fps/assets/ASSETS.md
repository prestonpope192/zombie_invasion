# FPS Asset References (CC0/Open)

The current FPS build ships with in-engine geometry and procedural materials for reliability/performance while preserving open licensing.

Recommended CC0 packs for next visual pass:

- Poly Haven textures (CC0): https://polyhaven.com/textures
- ambientCG textures (CC0): https://ambientcg.com
- Kenney 3D assets (CC0): https://kenney.nl/assets
- Quaternius models (free/open use): https://quaternius.com

Audio references:

- FreeSFX library (license per file): https://freesfx.co.uk
- Pixabay sound effects (free with attribution guidance): https://pixabay.com/sound-effects/
- Gemini Lyria 3 music generation reference: https://gemini.google/us/overview/music-generation/?hl=en

Original music shipped in `public/audio/music/` as of 2026-07-08:

- `menu_theme.mp3`
- `safe_house_intro.mp3`
- `shop_intermission.mp3`
- `raid_low.mp3`
- `raid_mid.mp3`
- `raid_high.mp3`
- `boss_battle.mp3`
- `victory_sting.mp3`
- `game_over_sting.mp3`
- `main_motif.mp3` (reference only; not currently wired to runtime music)
- `shop_intermission_alt.mp3` (alternate reference only; not currently wired)

These tracks are original generated-music renders supplied by Preston from
`/Users/preston/Downloads/Zombie Invasion.zip` on 2026-07-08. The source files
were Suno-downloaded `.m4a` files containing 48 kHz stereo Opus audio, converted
locally to MP3 with `ffmpeg` / `libmp3lame -q:a 2`.

Runtime cue mapping:

| Runtime file | Source file |
|---|---|
| `menu_theme.mp3` | `Zombie Invasion - Title Main Menu.m4a` |
| `safe_house_intro.mp3` | `Zombie Invasion - Safe House Wake-Up Start.m4a` |
| `shop_intermission.mp3` | `Zombie Invasion - Shop Intermission.m4a` |
| `raid_low.mp3` | `Zombie Invasion - Lane Defense Medium Threat Raid.m4a` |
| `raid_mid.mp3` | `Zombie Invasion - Horde Breach High Threat Raid.m4a` |
| `raid_high.mp3` | `Zombie Invasion - Boss Battle Mega Zombie.m4a` |
| `boss_battle.mp3` | `Zombie Invasion - Boss Battle Mega Zombie.m4a` |
| `victory_sting.mp3` | `Zombie Invasion - Victory Dawn Holdout.m4a` |
| `game_over_sting.mp3` | `Zombie Invasion - Game Over Village Lost Sting.m4a` |
| `main_motif.mp3` | `Zombie Invasion - Main Melodic Motif.m4a` |
| `shop_intermission_alt.mp3` | `Zombie Invasion - Shop Intermission_1.m4a` |

The prior tracks were procedural chiptune renders generated locally with
`scripts/generate-retro-music.mjs`; they were replaced by the generated-music
soundtrack above.

When adding external assets, record exact file source URLs and license notes in this file.
