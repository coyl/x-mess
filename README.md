# X-Mess for the browser

A faithful browser port of **X-Mess**, the Christmas puzzle game Martijn van der Lee made in
1998 as a computerised Christmas card for Windows 95 (DirectX, Delphi Games Creator).

> **Status: private preview for the original author.** Nothing here is licensed for
> redistribution yet. A license will be added once the author has agreed to the terms.

## Playing

The game is plain static files: no build step, no server-side code. Any web server
works; opening `index.html` straight from disk does not, because the page loads its
assets with `fetch`.

With Docker, the included image is nginx with the files inside:

```sh
docker build -t x-mess .
docker run --rm -p 8080:80 x-mess
```

Or serve the working copy as it is, without building an image:

```sh
docker run --rm -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:1.27-alpine
```

Then open <http://localhost:8080>. Click once (browsers keep sound off until the first
click or key press). Controls are the original ones:

| Key | Action |
|---|---|
| ← → | move the four blocks |
| ↑ | rotate clockwise |
| ↓ | drop one row faster |
| M / S | music / sound effects on or off |
| Esc | back to the title screen |
| any key | skip the intro, start a game |

## How faithful it is

The rules were not guessed from the manual; they were read from the machine code of
`X-Mess.exe` (methods `StepTimer`, `MoveBlocks`, `ResetBlocks`, `FallBlocks`,
`RemoveBlocks`, `Animate`, `DrawPlayfield`, `Intro`, `DrawPresentation`, `GameOver`,
`GetName`, `CheckScore`, `SnowFlakes`, `Print`). The port keeps:

- the 20 ms (50 Hz) game tick and all timings of the screens and animations;
- the level, speed and block-type tables (`js/tables.js`, with the original addresses);
- scoring exactly as coded: 1 point per row moved (also for a sideways push against a
  wall), +1 for the down key, 25 per placed piece, and 250 for *every tetromino shape*
  found in a group rather than a flood fill;
- quirks such as the falling piece stopping one row above the floor before gravity drops it;
- all screen coordinates, so it draws the same 640×480 frame the original did.

Browser-specific additions, kept to a minimum:

- a "click to run" prompt on the loading screen, because of browser audio rules;
- the screen scales to the window;
- on phones: on-screen buttons and a text field for entering a hiscore name;
- the swaying texts on the title, game-over and hiscore screens move three times slower
  than in the original (`WAVE_STEP` in `js/tables.js`; set it to 0.15 for the original);
- M and S work on every screen (the original only read them during a game, so on the
  title screen they started a new game instead);
- hiscores are kept in the browser's local storage instead of `Data\011.x98`;
- music is played by a small built-in General MIDI synthesizer (`js/audio.js`), so it
  sounds simpler than a 1998 sound card;
- the third page of the title screen showed the author's 1998 postal address; the
  greeting page is shown there instead.

## Assets

| Asset | Source |
|---|---|
| Blocks (8 ornaments, 177 frames), logo, "Hiscore!", "Game Over", intro sketches, intro paper, intro story text, wooden wall and frame, polaroid frames, snowflake | Original, by Martijn van der Lee, extracted unchanged |
| Christmas tree and presents on the main screen | **Redrawn** (original came from a Hema brochure and an unknown brochure) |
| Photo in the top-right polaroid | **Redrawn** as a snowman snapshot (original: a Halfords brochure photo) |
| Black marble score plate | **Redrawn** (original: unknown origin) |
| Night snow landscape in the playfield, snowy fence under the intro | **Redrawn** (original: Office '97 CD) |
| Bitmap font | **Redrawn** in the same ice-chrome style from Oswald (SIL Open Font License) (original: unknown Amiga artist) |
| Loading credit, snow wall, dark photo in the level polaroid | **Redrawn** to be safe; their origin is not stated |
| Sound effects | **New**, synthesised (originals: Office '97 CD and Rainbow Six) |
| Music | **New** arrangements of public-domain melodies: Silent Night, Jingle Bells, God Rest Ye Merry Gentlemen, We Wish You a Merry Christmas, Shchedryk (originals: various artists, including "Esoteric Journeys" by Igor Lalin) |
| Hiscore table | Placeholder names; the table that shipped with the game is not known |

The redrawn images are composited into the original screens and quantised to the game's
own 256-colour palette, so they sit in the same 1998 look.

Open questions for the author: which of the wooden wall, intro paper, snow wall and
playfield landscape were his own work (they can then go back to the originals), and
whether the original timer really ran at 50 Hz on Windows 95.

The original images were read straight out of the executable: the `TFORM1` form
resource holds a Delphi Games Creator `IL10` image library with a shared palette and 246
8-bit images. The files in `assets/` are the final result of that extraction and of the
replacement artwork.

## Layout

```
index.html, css/style.css
js/main.js      browser shell: loading, 50 Hz loop, input, scaling
js/game.js      the game: state machine, rules and drawing, following the original methods
js/tables.js    constants read from X-Mess.exe
js/audio.js     samples and the General MIDI synthesizer
assets/         images, sounds, music
Dockerfile      nginx image serving the files above
```
