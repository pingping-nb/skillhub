# SkillHub Extensions

Isolated, upgrade-safe customizations layered on top of the upstream
[`iflytek/skillhub`](https://github.com/iflytek/skillhub) repository.

Everything in this directory is **new code**. Nothing here edits an upstream
core source file, so a future `git pull` / `git rebase` of upstream produces
zero merge conflicts from these extensions.

## Why this directory exists

Upstream owns its core files. Editing them directly (e.g. `web/vite.config.ts`,
`web/docker-entrypoint.d/*.sh`, `charts/skillhub/values.yaml`) works today but
turns every upstream change to those lines into a merge conflict. This directory
holds the same behavior as **overlays and wrappers** instead.

## Layout

```
extensions/
├── README.md                     # this file
├── cli-npm-registry/             # extension: point UI + guide at a private npm registry
│   ├── README.md                 # what it does, how to enable, how to verify
│   ├── apply.sh                  # idempotent installer (copies overlays into place)
│   ├── revert.sh                 # removes overlays, restores upstream files
│   ├── overlays/                 # drop-in replacement files (upstream paths mirrored)
│   │   ├── web/
│   │   │   ├── vite.config.ts
│   │   │   ├── runtime-config.js.template
│   │   │   └── docker-entrypoint.d/30-runtime-config.sh
│   │   ├── charts/skillhub/
│   │   │   ├── values.yaml
│   │   │   ├── values.schema.json
│   │   │   └── templates/{configmap.yaml,web-deployment.yaml}
│   │   ├── compose.release.yml
│   │   └── docker-compose.staging.yml
│   └── patches/                  # minimal unified diffs for files we cannot replace wholesale
│       └── *.patch
└── lib/
    └── overlay.sh                # shared helpers: backup, apply, revert, drift check
```

## Two integration strategies

| Strategy | When to use | Conflict behavior |
|---|---|---|
| **Overlay** (`overlays/`) | The file is small and self-contained, or upstream rarely touches it. We ship a full replacement copy. | `apply.sh` overwrites the upstream file. On upstream pull, the file may conflict — but `revert.sh` restores it and re-applying is one command. |
| **Patch** (`patches/`) | The file is large and upstream changes it often. We ship a minimal unified diff. | `git apply --3way` re-applies cleanly or reports a precise conflict hunk. |

Both strategies keep the *source of truth* in `extensions/`, not in the upstream
file. The upstream file is treated as a build artifact.

## Usage

```bash
# Apply every extension (idempotent)
./extensions/apply-all.sh

# Apply one extension
./extensions/cli-npm-registry/apply.sh

# Check whether applied overlays have drifted from upstream
./extensions/lib/overlay.sh check

# Revert everything back to pristine upstream
./extensions/cli-npm-registry/revert.sh
```

## Rules for contributors

1. **Never edit an upstream file by hand.** Add an overlay or patch here instead.
2. **Keep overlays minimal.** An overlay should differ from upstream only in the
   lines the extension needs.
3. **Record the upstream base.** Each overlay stores the upstream blob hash it
   was derived from, so drift is detectable.
4. **One extension per directory.** Do not mix unrelated customizations.
5. **Document the enable/disable path** in the extension's own `README.md`.
