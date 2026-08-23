# dsh-opc

`dsh-opc` turns live DeepSeek Harness sessions into anime office workers and
ships an optional Tauri desktop pet for attention alerts.

```sh
dsh plugin --profile web add .
pnpm --dir desktop dev -- --dsh-url http://127.0.0.1:3080
```

On host activation the plugin automatically fetches `dsh-opc-assets.tar.gz`
from the latest GitHub release into `~/.dsh/opc/`; the office UI shows the
download progress. A linked local checkout with WebM clips already present is
treated as development mode and is never downloaded over. The release asset
contains the versioned character manifest and WebM clips. Clips are
intentionally ignored by Git; use `pnpm assets:dummy` for local placeholder
clips, replace them with licensed art before release, then run
`pnpm assets:pack`.

Each character state maps to a list of WebM files. The web office and pet
choose one randomly when a session enters that state. `assets/manifest.json`
maps exact model names to characters and sends unmatched models to
`office-default`.

The pet accepts only loopback HTTP(S) DSH URLs. It emits one notification per
approval/error identity and per long-running milestone (5, 10, 20, 30, 45, 60
minutes, then hourly); the notification ledger persists in
`~/.dsh/dsh-opc-pet/notification-ledger.json`.
