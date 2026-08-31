# dsh-opc

`dsh-opc` turns live DeepSeek Harness sessions into anime office workers and
ships an optional Tauri desktop pet for attention alerts.

```sh
dsh plugin --profile web add .
pnpm --dir desktop dev -- --dsh-url http://127.0.0.1:3080
```

This plugin is self-hosted: every asset (character WebM clips, pet loops, office
backgrounds, manifest) is read from the plugin's own `assets/` directory, and
no release archive is downloaded. Clips are intentionally ignored by Git; use
`pnpm assets:dummy` for placeholder clips and drop your real WebM files into
`assets/characters/<角色>/` and `assets/pet/` — they take effect on reload
(assets are served with `no-store`).

Each character state maps to a list of WebM files. The web office and pet
choose one randomly when a session enters that state. `assets/manifest.json`
maps exact model names to characters and sends unmatched models to
`office-default`.

The Office control opens a full-screen game-like operations floor. Select a
worker to open its direct channel and queue a prompt to that exact DSH session.
See [the animation asset guide](docs/animation-assets.md) for WebM authoring,
packing, and the exact manifest/state matching rules.

The pet accepts only loopback HTTP(S) DSH URLs. It emits one notification per
approval/error identity and per long-running milestone (5, 10, 20, 30, 45, 60
minutes, then hourly); the notification ledger persists in
`~/.dsh/dsh-opc-pet/notification-ledger.json`.
