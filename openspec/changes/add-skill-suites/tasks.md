## 1. Persistence and domain model

- [ ] 1.1 Add Flyway migrations for `skill_suite`, `skill_suite_version`, and `skill_suite_version_member`, including per-type slug uniqueness, version uniqueness, version-level visibility, ordering, snapshot fields, indexes, and `ON DELETE SET NULL` member references.
- [ ] 1.2 Implement Suite aggregate entities, statuses, repositories, package boundaries, and domain invariants for 100-member limits, exact versions, duplicate detection, and Entry Skill membership.
- [ ] 1.3 Add focused repository and domain tests for same-slug Skill/Suite coexistence, immutable published versions, hard-deleted member snapshots, and latest-version recalculation.
- [ ] 1.4 Implement computed Suite availability and blocking reasons without adding degraded to the persisted SuiteVersion lifecycle enum.

## 2. Lifecycle, authorization, and review

- [ ] 2.1 Implement Suite draft, submit, approve, reject, direct-private-publish, yank, hide, restore, archive, and delete workflows without Member lifecycle side effects.
- [ ] 2.2 Generalize review tasks to typed subjects, backfill existing rows as `SKILL_VERSION`, and preserve all existing Skill review behavior and queries.
- [ ] 2.3 Reuse Namespace/platform authorization rules and add Suite-specific audit events for every material lifecycle action.
- [ ] 2.4 Add tests covering roles, self-review rules, member eligibility revalidation at submit/approve/publish, visibility compatibility, namespace freeze/archive, and non-cascading governance.
- [ ] 2.5 Add a rollout compatibility gate so Suite review writes are enabled only after all active application versions support typed review subjects.
- [ ] 2.6 Implement rejected-to-draft resubmission with immutable review rounds, and prevent published/yanked version edits.

## 3. Server API and search

- [ ] 3.1 Add transport-only Suite controllers and application services for management, version history, review actions, detail, and typed resolution of install plans.
- [ ] 3.2 Add a typed resource discovery projection with `resourceType` and Suite metadata while keeping the existing Skill search endpoint Skill-only.
- [ ] 3.3 Return ordered Member snapshots, Entry Skill, availability, and degraded reasons without N+1 member resolution.
- [ ] 3.4 Regenerate `web/src/api/generated/schema.d.ts` with `make generate-api` and run the OpenAPI drift check.
- [ ] 3.5 Record idempotent Suite-plan and Member-download audit/statistics using a shared operation ID, preserving the existing server-side download-count semantics.
- [ ] 3.6 Add a server-filtered Member candidate query scoped by caller access, Suite Namespace, target visibility, current installability, and exact versions.

## 4. Web experience

- [ ] 4.1 Add typed Skill/Suite search cards and independent Suite list/detail/version routes.
- [ ] 4.2 Add Suite creation and draft editing with the server-filtered Member picker, exact published versions, ordering, visibility, and optional Entry Skill.
- [ ] 4.3 Extend the review center with typed Suite review details and ensure existing Skill review actions remain unchanged.
- [ ] 4.4 Add install instructions using `skillhub suite install`, degraded-member explanations, and responsive/error/loading/empty states.
- [ ] 4.5 Default Member selection to the current installable version, display the pinned exact version, and provide an explicit version-diff update action for drafts.

## 5. CLI and local lifecycle

- [ ] 5.1 Add `skillhub suite install/check/upgrade/remove` and a typed Suite resolver without changing `skillhub install` resolution.
- [ ] 5.2 Extend the existing staged installer to preflight, download, fingerprint-check, lock, commit, and roll back all Members and selected Agent targets as one operation.
- [ ] 5.3 Extend inventory with backward-compatible Suite snapshots and multi-source `installedBy` provenance.
- [ ] 5.4 Implement safe Suite removal that preserves direct-installed, shared, unknown-source, or locally modified Member directories.
- [ ] 5.5 Add CLI tests for same-slug Skill/Suite, missing permissions, unavailable members, checksum failure, disk/rename failure, incomplete rollback reporting, shared members, legacy inventory, and multi-Agent targets.
- [ ] 5.6 Add Server capability detection and old-Server/new-CLI plus new-Server/old-CLI compatibility tests.

## 6. Documentation and validation

- [ ] 6.1 Document `suite.yaml`, Suite/Skill terminology, typed coordinates, lifecycle boundaries, CLI commands, compatibility, and operator limits.
- [ ] 6.2 Run targeted backend tests, `make test-backend-app`, frontend unit/type/lint checks, CLI tests/build, and OpenAPI drift validation.
- [ ] 6.3 Build exact-SHA local Server/Web images and run authenticated Compose smoke tests for ordinary Skill and Suite flows.
- [ ] 6.4 Execute the OpenSpec scenario matrix, including normal flow, same-slug compatibility, lifecycle independence, degraded members, authorization, atomic failure/recovery, upgrade, removal, rolling review migration, legacy inventory, and old/new Server/CLI combinations.
- [ ] 6.5 Complete independent implementation review, manual Web/CLI retest instructions, privacy/readiness checks, and the Chinese merge-readiness report before requesting merge authorization.
