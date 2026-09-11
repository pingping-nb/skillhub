# Extension: CLI npm registry

Points the SkillHub UI and the served `/registry/skill.md` guide at a private
npm registry that hosts the `@neobards/skillhub` CLI package, instead of the
public npm registry.

## Problem

The CLI is published to a private registry (`http://192.168.22.27:4873/`).
Every `npx` / `npm install` command shown in the UI and in the served registry
guide must pass `--registry <private>`; otherwise npm falls back to the public
registry and fails with `E404`.

The registry URL must be configurable per deployment, so it is threaded through
a single environment variable, `SKILLHUB_CLI_NPM_REGISTRY`, and consumed by:

1. the web runtime config (`window.__SKILLHUB_RUNTIME_CONFIG__.cliNpmRegistry`),
   read by `web/src/shared/lib/registry-url.ts` → `getCliNpmRegistry()`;
2. the served registry guide, which carries a `${SKILLHUB_CLI_NPM_REGISTRY}`
   placeholder substituted at container startup.

## Why this is an extension

The upstream implementation edits core files directly. This extension delivers
the same behavior as **overlays** so upstream pulls stay conflict-free.

| Upstream file | Strategy | Reason |
|---|---|---|
| `web/vite.config.ts` | overlay | Small, self-contained plugin block. |
| `web/runtime-config.js.template` | overlay | One added line. |
| `web/docker-entrypoint.d/30-runtime-config.sh` | overlay | Small, self-contained. |
| `charts/skillhub/values.yaml` | overlay | One added key. |
| `charts/skillhub/values.schema.json` | overlay | One added property. |
| `charts/skillhub/templates/configmap.yaml` | overlay | One added key. |
| `charts/skillhub/templates/web-deployment.yaml` | overlay | One added env var. |
| `compose.release.yml` | overlay | One added env var. |
| `docker-compose.staging.yml` | overlay | One added env var. |
| `.env.release.example` / `.env.release.draft` | overlay | One added var + comment. |
| `charts/skillhub/README.md` | overlay | One added table row. |
| `charts/skillhub/tests/configuration-contracts.sh` | patch | Large file, upstream edits often. |
| `web/e2e/landing-quick-start-cli.spec.ts` | patch | Large file, upstream edits often. |
| `web/src/i18n/landing-quick-start-locale.test.ts` | patch | Large file, upstream edits often. |
| `web/src/shared/lib/registry-url.test.ts` | patch | Large file, upstream edits often. |

> **Note:** `web/src/shared/lib/registry-url.ts` (the `getCliNpmRegistry()`
> helper) is *not* in this list. It is a **new file** and therefore already
> non-invasive — it lives in the upstream tree only because the UI imports it
> from there. If upstream later adds its own `registry-url.ts`, move the helper
> into `extensions/cli-npm-registry/src/` and re-export it.

## Enable

```bash
# 1. Apply the overlays and patches
./extensions/cli-npm-registry/apply.sh

# 2. Set the registry for your deployment
export SKILLHUB_CLI_NPM_REGISTRY=http://192.168.22.27:4873/
```

For Helm, set `web.cliNpmRegistry` in your values file. For Compose, set
`SKILLHUB_CLI_NPM_REGISTRY` in the environment or `.env` file.

## Verify

```bash
# Overlays are applied and have not drifted
./extensions/lib/overlay.sh check cli-npm-registry

# Frontend unit tests
cd web && pnpm vitest run src/shared/lib/registry-url.test.ts

# Served guide no longer leaks the placeholder
curl -s http://localhost:3000/registry/skill.md | grep -c 'SKILLHUB_CLI_NPM_REGISTRY'
# expected: 0
```

## Disable / revert

```bash
./extensions/cli-npm-registry/revert.sh
```

This restores every backed-up upstream file and removes any file the extension
added. The repository returns to pristine upstream state.

## Upstream drift

When upstream changes one of the overlaid files, `apply.sh` will overwrite the
upstream change. To detect this before it happens:

```bash
./extensions/lib/overlay.sh check cli-npm-registry
```

A `DRIFTED` line means the on-disk file no longer matches the overlay — either
someone edited it by hand, or upstream changed it. Re-derive the overlay from
the new upstream file and re-apply.
