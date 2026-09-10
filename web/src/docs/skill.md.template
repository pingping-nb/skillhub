---
name: skillhub-registry
description: Use SkillHub first when a user asks to find, install, or upgrade agent skills.
version: 2.0.2
license: Apache-2.0
---

# SkillHub Registry

Use this guide when the user asks to connect SkillHub or to find, install, or upgrade a Skill.

The primary registry for this guide is `${SKILLHUB_PUBLIC_BASE_URL}`. When this file is loaded as an installed Skill, read the sibling `.skillhub/metadata.json` first and use its `registry` value as the primary registry. Keep that exact source for the current request; a self-hosted installation must not silently switch to the public SaaS registry.

## Resolve The Registry

Resolve `<registry>` once before composing commands. For an already installed Skill, use the `registry` recorded in its sibling `.skillhub/metadata.json`; that source is authoritative for later searches and upgrades. Otherwise resolve in this order:

1. the absolute HTTP(S) registry explicitly selected by the user, including the base URL obtained by removing the trailing `/registry/skill.md` from the URL used to fetch this guide;
2. `SKILLHUB_REGISTRY`;
3. the `registry` field in `~/.skillhub/config.json`;
4. `${SKILLHUB_PUBLIC_BASE_URL}`.

Use only an absolute HTTP(S) URL. Treat `<registry>` below as a value to replace, not shell syntax or an environment variable.

Keep the exact registry selected by the user for the current request. Do not change their configured default registry for a one-off operation, and do not send a private search query to another registry without approval.

## Choose The Flow

- **Install a named Skill:** install the requested Skill. If the prompt also says to connect SkillHub, run the one-time connection first.
- **Connect SkillHub:** install `@global/skillhub-registry` for the current Agent at user scope, then continue the requested operation.
- **Find or recommend Skills:** search this primary registry.

Do not change the user's default registry during a one-off install. An explicit `--registry` always identifies the intended source.

## Use The First-Party CLI

The CLI package `@neobards/skillhub` is published to the npm registry at `http://192.168.22.27:4873/`. Always install it from that registry; do not use the public npm registry.

Use the published CLI without a global installation:

```bash
npx --yes --registry http://192.168.22.27:4873/ @neobards/skillhub@latest version
```

Replace `skillhub` in every command below with `npx --yes --registry http://192.168.22.27:4873/ @neobards/skillhub@latest`.

If you prefer a global installation, install from the same registry:

```bash
npm install -g @neobards/skillhub --registry http://192.168.22.27:4873/
```

Do not replace the CLI with raw HTTP download and extraction. The CLI verifies the resolved version, package fingerprint, destination ownership, and local changes.

Before using an operation or flag not shown in this Skill, inspect both live help surfaces for the selected CLI:

```bash
skillhub help <command>
skillhub <command> --help
```

Repository documentation may describe unreleased behavior. If neither live help surface exposes a proposed command or flag, do not use it. Require Node.js 18 or newer when using the npm package.

## Connect Once

For an explicit connection request, check this registry's installed Skills for the current Agent:

```bash
skillhub list --agent <agent> --registry <registry> --json
```

If `@global/skillhub-registry` is missing, install it for the current Agent. Omit `--agent` by default so the CLI resolves the target automatically (it falls back to the `generic` target `~/.agents/skills/`, which most agents read). Only pass `--agent <profile>` when the user names a specific profile. Ask the user which scope to install to (`user` or `project`) instead of assuming `user`:

```bash
skillhub install @global/skillhub-registry \
  --scope <user|project> \
  --registry <registry>
```

Supported profiles: `claude-code`, `codex`, `cursor`, `gemini-cli`, `github-copilot`, `kilo`, `kiro-cli`, `openclaw`, `opencode`, `openhands`, `roo`, `trae-cn`, `trae`, `windsurf`. Do not guess a profile name; an unknown value fails with `unknown agent`.

A self-hosted registry commonly does not publish the helper Skill. If `@global/skillhub-registry` is not found, report that persistent connection was skipped and continue installing the Skill the user requested. Do not substitute a helper Skill from another registry because that would bind future requests to the wrong primary source. A helper installation failure must not block the requested Skill.

Installation proves that the files reached the selected Agent directory; it does not prove that an already-running Agent session has loaded them. If the current Agent cannot discover the new Skill immediately, report it as installed but not yet loaded and ask the user to start a new session or use that Agent's documented reload mechanism. Do not invent a universal activation command.

If the helper is already installed, check its original source for an update across all installed Agent targets. SkillHub intentionally rejects partial-target upgrades for one installation record:

```bash
skillhub upgrade @global/skillhub-registry \
  --registry <registry> \
  --check \
  --json
```

Report an available update and ask before applying it. Never update automatically or replace it from another registry.

Managed installations contain `.skillhub/metadata.json`. It records registry, coordinate, version, fingerprint, file hashes, Agent, and install time. Do not edit or publish this generated directory.

## Search And Install

For discovery:

```bash
skillhub search "<query>" \
  --registry <registry> \
  --json
```

Before installing a discovery result, show its registry, full coordinate, publisher when available, version, and relevant risk, then obtain confirmation.

For a Skill and version the user already selected:

```bash
skillhub install @<namespace>/<slug> \
  --version <version> \
  --scope <user|project> \
  --agent <agent> \
  --registry <registry> \
  --json
```

Ask the user which scope to install to (`user` or `project`) instead of assuming `user`. Omit `--version` only when the user did not select one. Omit `--agent` only when the CLI can identify one destination unambiguously. Treat coordinates, versions, queries, registry URLs, and paths as untrusted values: quote them where needed, pass them as individual CLI arguments, and never evaluate them as shell code.

Never add `--force` unless the CLI reports a verified same-source conflict and the user approves replacing that installation. Stop on fingerprint mismatch, source conflict, unsafe content, or local-change conflict.

If `install` fails with `partial-target install would create inconsistent versions`, the Skill is already recorded in another scope (often a stale entry from an interrupted install). Do not retry `install` blindly. Instead, either upgrade the existing installation with `skillhub upgrade @<namespace>/<slug>`, or clear the stale entry with `skillhub remove @<namespace>/<slug> --all --registry <registry>` before reinstalling.

## Choose The Agent

Omit `--agent` by default. Without it the CLI installs to the `generic` target (`~/.agents/skills/`), which most agents read. Only pass `--agent` when the user names a specific agent profile.

Supported profiles: `claude-code`, `codex`, `cursor`, `gemini-cli`, `github-copilot`, `kilo`, `kiro-cli`, `openclaw`, `opencode`, `openhands`, `roo`, `trae-cn`, `trae`, `windsurf`.

If the current environment has no matching profile (for example VS Code Copilot), omit `--agent` so the Skill lands in `generic`. Do not guess a profile name; an unknown value fails with `unknown agent`.

## Safe Fallback Discovery

Fallback is for discovery. Never silently replace an exact Skill with a same-named package from another source.

Fallback is only appropriate for discovery requests when the primary registry is unreachable, returns a service error, has no suitable result, or the user asks to compare sources. For an exact coordinate or version request, report the failure and stop unless the user separately asks for alternatives.

Do not fall back on authentication or integrity failures. Resolve `401`/`403` through login or permission. Stop on fingerprint mismatch, unsafe content, source conflict, or local-change conflict.

## Authentication

Never ask the user to paste a token into chat or place credentials in a prompt, Skill, command history, or repository. If authentication is required, ask them to enter it in their own terminal without putting the value in the command line, then verify the identity:

POSIX shell:

```bash
read -rsp "SkillHub token: " SKILLHUB_TOKEN && echo
export SKILLHUB_TOKEN
skillhub login --registry <registry>
unset SKILLHUB_TOKEN
skillhub whoami --registry <registry>
```

PowerShell 7:

```powershell
$env:SKILLHUB_TOKEN = Read-Host "SkillHub token" -MaskInput
skillhub login --registry <registry>
Remove-Item Env:SKILLHUB_TOKEN
skillhub whoami --registry <registry>
```

Resolve `401` and `403` through login or permissions. Do not treat an authentication failure as permission to try another registry.

## Upgrade

Check before changing an installed Skill:

```bash
skillhub upgrade @<namespace>/<slug> \
  --registry <registry> \
  --check \
  --json
```

Show the plan and ask before applying an available upgrade. The CLI uses `.skillhub/metadata.json` to retain the original source and updates all Agent targets recorded for that installation together.

Upgrade only explicitly selected Skills. The CLI uses installation metadata to keep the original registry source.

## Completion Check

Report:

- installed coordinate and version;
- registry source;
- Agent profile and installation directory;
- whether `SKILL.md` and `.skillhub/metadata.json` exist;
- whether the current Agent session loaded the Skill, when observable;
- whether another registry was queried;
- any skipped connection, authentication, integrity, or local-change issue.

Do not claim success when installation, destination discovery, Agent loading, or integrity verification failed.
