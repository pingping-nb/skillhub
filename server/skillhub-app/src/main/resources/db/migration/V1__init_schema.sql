-- Phase 1 核心表：認證與授權

-- 使用者賬號表
CREATE TABLE user_account (
    id VARCHAR(128) PRIMARY KEY,
    display_name VARCHAR(128) NOT NULL,
    email VARCHAR(256),
    avatar_url VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    merged_to_user_id VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_account_email ON user_account(email);
CREATE INDEX idx_user_account_status ON user_account(status);

-- OAuth 身份繫結表
CREATE TABLE identity_binding (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    provider_code VARCHAR(64) NOT NULL,
    subject VARCHAR(256) NOT NULL,
    login_name VARCHAR(128),
    extra_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_code, subject)
);

CREATE INDEX idx_identity_binding_user_id ON identity_binding(user_id);

-- API Token 表
CREATE TABLE api_token (
    id BIGSERIAL PRIMARY KEY,
    subject_type VARCHAR(32) NOT NULL DEFAULT 'USER',
    subject_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    name VARCHAR(128) NOT NULL,
    token_prefix VARCHAR(16) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    scope_json JSONB NOT NULL,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_token_user_id ON api_token(user_id);
CREATE INDEX idx_api_token_hash ON api_token(token_hash);

-- 角色表
CREATE TABLE role (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 許可權表
CREATE TABLE permission (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    group_code VARCHAR(64)
);

-- 角色許可權關聯表
CREATE TABLE role_permission (
    role_id BIGINT NOT NULL REFERENCES role(id),
    permission_id BIGINT NOT NULL REFERENCES permission(id),
    PRIMARY KEY (role_id, permission_id)
);

-- 使用者角色繫結表
CREATE TABLE user_role_binding (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    role_id BIGINT NOT NULL REFERENCES role(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_role_binding_user_id ON user_role_binding(user_id);

-- 名稱空間表
CREATE TABLE namespace (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(128) REFERENCES user_account(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 名稱空間成員表
CREATE TABLE namespace_member (
    id BIGSERIAL PRIMARY KEY,
    namespace_id BIGINT NOT NULL REFERENCES namespace(id),
    user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(namespace_id, user_id)
);

CREATE INDEX idx_namespace_member_user_id ON namespace_member(user_id);
CREATE INDEX idx_namespace_member_namespace_id ON namespace_member(namespace_id);

-- 審計日誌表
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id VARCHAR(128) REFERENCES user_account(id),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64),
    target_id BIGINT,
    request_id VARCHAR(64),
    client_ip VARCHAR(64),
    user_agent VARCHAR(512),
    detail_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_request_id ON audit_log(request_id);

-- 插入系統內建角色
INSERT INTO role (code, name, description, is_system) VALUES
('SUPER_ADMIN', '超級管理員', '擁有所有許可權', TRUE),
('SKILL_ADMIN', '技能管理員', '全域性空間稽核、提升稽核、隱藏/撤回', TRUE),
('USER_ADMIN', '使用者管理員', '准入審批、封禁/解封、角色分配', TRUE),
('AUDITOR', '審計員', '檢視審計日誌', TRUE);

-- 插入系統許可權
INSERT INTO permission (code, name, group_code) VALUES
('skill:publish', '發布技能', 'skill'),
('skill:manage', '管理技能', 'skill'),
('skill:promote', '提升到全域性', 'skill'),
('review:approve', '稽核技能', 'review'),
('promotion:approve', '稽核提升申請', 'promotion'),
('user:manage', '管理使用者', 'user'),
('user:approve', '審批使用者准入', 'user'),
('audit:read', '檢視審計日誌', 'audit');

-- 繫結角色許可權
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p WHERE r.code = 'SKILL_ADMIN' AND p.code IN ('review:approve', 'skill:manage', 'promotion:approve');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p WHERE r.code = 'USER_ADMIN' AND p.code IN ('user:manage', 'user:approve');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p WHERE r.code = 'AUDITOR' AND p.code = 'audit:read';

-- 插入系統內建 @global 名稱空間
INSERT INTO namespace (slug, display_name, type, description, status)
VALUES ('global', 'Global', 'GLOBAL', 'Platform-level public namespace', 'ACTIVE');
