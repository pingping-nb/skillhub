-- V49__remove_builtin_skill_publisher.sql
-- Remove the "Built-in Skill Publisher" system account and all skills it owns
-- in the global namespace. This complements disabling skillhub.builtin-skills.enabled
-- by cleaning up data that was already synchronized before the feature was turned off.

-- Identify the global namespace and the system publisher account.
-- All built-in skills live in the global namespace and are owned by builtin-skill-publisher.

-- 1. Soft-delete security audit history for the built-in skill versions.
DELETE FROM security_audit
WHERE skill_version_id IN (
    SELECT sv.id
    FROM skill_version sv
    JOIN skill s ON s.id = sv.skill_id
    JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global'
      AND s.owner_id = 'builtin-skill-publisher'
);

-- 2. Remove scan task outbox entries for the built-in skill versions.
DELETE FROM scan_task_outbox
WHERE version_id IN (
    SELECT sv.id
    FROM skill_version sv
    JOIN skill s ON s.id = sv.skill_id
    JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global'
      AND s.owner_id = 'builtin-skill-publisher'
);

-- 3. Review tasks (skill_version_id is ON DELETE SET NULL, skill_id has FK).
DELETE FROM review_task
WHERE skill_id IN (
    SELECT s.id
    FROM skill s
    JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global'
      AND s.owner_id = 'builtin-skill-publisher'
);

-- 4. Promotion requests referencing built-in skills as source or target.
DELETE FROM promotion_request
WHERE source_skill_id IN (
        SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
        WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
    )
   OR target_skill_id IN (
        SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
        WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
    );

-- 5. Skill tags (FK to skill and skill_version).
DELETE FROM skill_tag
WHERE skill_id IN (
    SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
);

-- 5b. Search documents (UNIQUE FK to skill).
DELETE FROM skill_search_document
WHERE skill_id IN (
    SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
);

-- 5c. Stars and ratings (FK to skill).
DELETE FROM skill_star
WHERE skill_id IN (
    SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
);

DELETE FROM skill_rating
WHERE skill_id IN (
    SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
);

-- 6. Skill files (FK to skill_version).
DELETE FROM skill_file
WHERE version_id IN (
    SELECT sv.id
    FROM skill_version sv
    JOIN skill s ON s.id = sv.skill_id
    JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global'
      AND s.owner_id = 'builtin-skill-publisher'
);

-- 7. Clear latest_version_id on built-in skills (FK to skill_version).
UPDATE skill
SET latest_version_id = NULL
WHERE namespace_id IN (SELECT id FROM namespace WHERE slug = 'global')
  AND owner_id = 'builtin-skill-publisher';

-- 8. Skill versions (FK to skill).
DELETE FROM skill_version
WHERE skill_id IN (
    SELECT s.id FROM skill s JOIN namespace n ON n.id = s.namespace_id
    WHERE n.slug = 'global' AND s.owner_id = 'builtin-skill-publisher'
);

-- 9. Skills themselves.
DELETE FROM skill
WHERE namespace_id IN (SELECT id FROM namespace WHERE slug = 'global')
  AND owner_id = 'builtin-skill-publisher';

-- 10. Namespace membership of the publisher in the global namespace.
DELETE FROM namespace_member
WHERE user_id = 'builtin-skill-publisher';

-- 10b. Defensive cleanup: any role bindings or API tokens the publisher may hold.
DELETE FROM user_role_binding
WHERE user_id = 'builtin-skill-publisher';

DELETE FROM api_token
WHERE user_id = 'builtin-skill-publisher';

-- 11. The system publisher account itself.
DELETE FROM user_account
WHERE id = 'builtin-skill-publisher';
