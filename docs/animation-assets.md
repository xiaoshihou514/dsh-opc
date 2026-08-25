# Animation assets

`dsh-opc` uses short, seamless WebM loops. It never creates animation at
runtime: the manifest chooses a prepared clip when a session enters a state.

## Directory layout

Put clips under `assets/characters/<character-id>/` and list every filename in
`assets/manifest.json`:

```text
assets/
  manifest.json
  characters/
    office-default/
      thinking-0.webm
      thinking-1.webm
      reading-0.webm
    architect/
      writing-0.webm
```

The file name itself is descriptive only. The manifest is authoritative, so a
clip is served only when it is listed under a character and state.

## Make a loop

1. Create or license artwork that is permitted for redistribution. Keep a
   record of the source and licence beside the source project; do not commit
   large binary clips to this repository.
2. Animate a loop with a stable first/last pose. Character movement should be
   readable without sound. Avoid strobing and full-frame flashes.
3. Export a transparent or opaque image sequence at a consistent aspect ratio.
   The current office cards work best with a portrait-ish frame such as
   640×800; keep the subject centred with room for the in-app desk label.
4. Encode to VP9 WebM. This command makes a broadly compatible, muted loop:

   ```sh
   ffmpeg -framerate 24 -i frames/%04d.png \
     -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 34 \
     -an assets/characters/architect/writing-0.webm
   ```

   Use `yuv420p` instead of `yuva420p` for clips without alpha. Check the
   output with `ffprobe` and play it in a browser before packing. Aim for
   short (2–8 second) clips and modest dimensions so several workers can play
   at once.

5. Add the filename to the correct state array, run `pnpm assets:pack`, and
   test through `just dev-web` or a linked `dsh plugin --profile web add .`.

`pnpm assets:dummy` creates ignored placeholder clips for UI development. It
does not produce release-quality assets.

## State matching

The host maps a live session to exactly one of these states:

| State      | Used when                                    |
| ---------- | -------------------------------------------- |
| `idle`     | The agent is idle and ready for work.        |
| `thinking` | The agent is running without an active tool. |
| `reading`  | A read-only tool is active.                  |
| `writing`  | A mutating/editing tool is active.           |
| `await`    | A manual approval is open.                   |
| `error`    | The current turn ends in an error.           |

When the state changes, the client chooses one entry at random from
`characters[character-id].states[state]`. If that list is absent, it tries the
fallback character's list; if that also fails, a labeled in-UI fallback is
shown. The `<video>` element loops the selected clip.

Character assignment comes from `modelCharacters`: an exact model name maps to
a character ID. Any unmatched model uses `fallbackCharacter`.

```json
{
  "fallbackCharacter": "office-default",
  "modelCharacters": { "gpt-5.6": "architect" },
  "characters": {
    "architect": {
      "states": { "writing": ["writing-0.webm", "writing-1.webm"] }
    }
  }
}
```

Every production character should provide all six states; the fallback is a
safety net, not a substitute for a complete character set.
