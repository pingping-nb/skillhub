# Phase 4: 運維增強 + 打磨 + 開源就緒 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 擴充套件認證體系（本地密碼登入 + 多賬號合併）、完善治理（技能隱藏/撤回 + 審計日誌查詢）、提升可觀測性（Prometheus）、最佳化效能（索引 + 預簽名 URL + 前端程式碼分割）、加固安全、實現 Docker 一鍵啟動和 K8s 部署，建立開源專案基礎設施。

**Architecture:** 後端沿用 Spring Boot 3.x 分層架構（skillhub-auth / skillhub-domain / skillhub-app / skillhub-infra / skillhub-storage / skillhub-search），前端沿用 React 19 + TanStack Router + TanStack Query。新增本地認證獨立於 OAuth 體系，透過 `local_credential` 表存在性判斷認證來源。4 個 Chunk 漸進交付。

**身份主鍵約束：** 使用者身份主鍵全鏈路統一使用 `string`。本計劃裡所有 `userId`、`primaryUserId`、`secondaryUserId`、`hiddenBy`、`yankedBy`、`actorUserId` 等使用者標識欄位均按字串實現；歷史 `Long` / `BIGINT` 描述不再有效。

**Tech Stack:** Java 21, Spring Boot 3.2, Spring Security, Spring Data JPA, Flyway, PostgreSQL 16, Redis 7, BCrypt, Micrometer/Prometheus, React 19, TypeScript, Vite, TanStack Router/Query, shadcn/ui, Docker, Kubernetes

**Spec:** `docs/superpowers/specs/2026-03-12-phase4-ops-polish-design.md`

---

## File Structure

### Chunk 1: 本地認證 + 多賬號合併

**New files (backend):**
- `server/skillhub-app/src/main/resources/db/migration/V4__phase4_auth_governance.sql` — Flyway 遷移
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredential.java` — 本地憑證實體
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredentialRepository.java` — 憑證倉儲介面
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidator.java` — 密碼策略校驗
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalAuthService.java` — 本地認證服務
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequest.java` — 合併請求實體
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequestRepository.java` — 合併倉儲介面
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeService.java` — 合併服務
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/LocalAuthController.java` — 本地認證 Controller
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/AccountMergeController.java` — 合併 Controller
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalRegisterRequest.java` — 註冊請求 DTO
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalLoginRequest.java` — 登入請求 DTO
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/ChangePasswordRequest.java` — 修改密碼 DTO
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeInitiateRequest.java` — 發起合併 DTO
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeVerifyRequest.java` — 驗證合併 DTO
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/config/SeedDataRunner.java` — 種子資料初始化
- `server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/LocalCredentialJpaRepository.java` — JPA 實現
- `server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/AccountMergeRequestJpaRepository.java` — JPA 實現

**New files (backend tests):**
- `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidatorTest.java`
- `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/LocalAuthServiceTest.java`
- `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/merge/AccountMergeServiceTest.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/LocalAuthControllerTest.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/AccountMergeControllerTest.java`

**Modified files (backend):**
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/config/SecurityConfig.java` — 新增本地認證端點 permitAll + BCrypt Bean
- `server/skillhub-app/src/main/resources/messages.properties` — 新增 i18n 訊息
- `server/skillhub-app/src/main/resources/messages_zh.properties` — 新增中文訊息

**New files (frontend):**
- `web/src/pages/register.tsx` — 註冊頁
- `web/src/pages/settings/security.tsx` — 密碼修改頁
- `web/src/pages/settings/accounts.tsx` — 賬號合併頁
- `web/src/features/auth/use-local-auth.ts` — 本地認證 Hook
- `web/src/features/auth/use-account-merge.ts` — 賬號合併 Hook

**Modified files (frontend):**
- `web/src/pages/login.tsx` — 新增使用者名稱密碼 Tab
- `web/src/app/router.tsx` — 新增新路由

### Chunk 2: 技能治理 + 審計日誌 + 可觀測性

**New files (backend):**
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceService.java` — 治理服務
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditLog.java` — 審計日誌實體（如不存在）
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditLogRepository.java` — 審計日誌倉儲
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditLogQueryService.java` — 審計日誌查詢
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/admin/AdminSkillController.java` — 技能治理 Controller
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/admin/AuditLogController.java` — 審計日誌 Controller
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/config/MetricsConfig.java` — Prometheus 指標配置

**New files (backend tests):**
- `server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceServiceTest.java`
- `server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/audit/AuditLogQueryServiceTest.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/admin/AdminSkillControllerTest.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/admin/AuditLogControllerTest.java`

**Modified files (backend):**
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/Skill.java` — 新增 hidden/hiddenAt/hiddenBy 欄位
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/SkillVersion.java` — 新增 yankedAt/yankedBy/yankReason 欄位
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/SkillVersionStatus.java` — 新增 YANKED 列舉值
- `server/skillhub-app/src/main/resources/application.yml` — Actuator + Prometheus 配置

**New files (frontend):**
- `web/src/pages/admin/audit-logs.tsx` — 審計日誌頁
- `web/src/features/admin/use-audit-logs.ts` — 審計日誌 Hook
- `web/src/features/skill/skill-governance-actions.tsx` — 隱藏/撤回操作元件

### Chunk 3: 效能最佳化 + 安全加固

**Modified files (backend):**
- `server/skillhub-storage/src/main/java/com/iflytek/skillhub/storage/ObjectStorageService.java` — 新增 generatePresignedUrl 方法
- `server/skillhub-storage/src/main/java/com/iflytek/skillhub/storage/S3StorageService.java` — 實現預簽名 URL
- `server/skillhub-storage/src/main/java/com/iflytek/skillhub/storage/LocalFileStorageService.java` — 返回 null（降級）
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/portal/SkillController.java` — 下載 302 重定向
- `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/config/SecurityConfig.java` — 安全響應頭
- `server/skillhub-app/src/main/resources/application.yml` — Session Cookie 安全配置

**New files (backend tests):**
- `server/skillhub-storage/src/test/java/com/iflytek/skillhub/storage/S3StorageServicePresignedUrlTest.java`

**Modified files (frontend):**
- `web/src/app/router.tsx` — lazy routes 改造
- `web/src/features/skill/markdown-renderer.tsx` — rehype-sanitize 整合

### Chunk 4: Docker 一鍵啟動 + K8s + 開源基礎設施

**New files:**
- `Dockerfile` — 多階段構建（根目錄）
- `deploy/nginx/default.conf` — Nginx SPA 配置
- `deploy/k8s/backend-deployment.yaml`
- `deploy/k8s/frontend-deployment.yaml`
- `deploy/k8s/services.yaml`
- `deploy/k8s/ingress.yaml`
- `deploy/k8s/configmap.yaml`
- `deploy/k8s/secret.yaml.example`
- `README.md` — 專案 README
- `CONTRIBUTING.md` — 貢獻指南
- `LICENSE` — Apache 2.0
- `CODE_OF_CONDUCT.md` — 行為準則
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

**Modified files:**
- `docker-compose.yml` — 新增 backend/frontend 服務 + 健康檢查

---

## Chunk 1: 本地認證 + 多賬號合併

### Task 1.1: Flyway 遷移 — local_credential + account_merge_request

**Files:**
- Create: `server/skillhub-app/src/main/resources/db/migration/V4__phase4_auth_governance.sql`

- [ ] **Step 1: 編寫遷移指令碼**

```sql
-- V4__phase4_auth_governance.sql

-- 本地密碼憑證
CREATE TABLE local_credential (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_local_credential_username ON local_credential(username);
CREATE UNIQUE INDEX idx_local_credential_user_id ON local_credential(user_id);

-- 賬號合併請求
CREATE TABLE account_merge_request (
    id BIGSERIAL PRIMARY KEY,
    primary_user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    secondary_user_id VARCHAR(128) NOT NULL REFERENCES user_account(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    verification_token VARCHAR(255),
    token_expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_merge_primary_status ON account_merge_request(primary_user_id, status);
CREATE UNIQUE INDEX idx_merge_secondary_pending ON account_merge_request(secondary_user_id) WHERE status = 'PENDING';
CREATE INDEX idx_merge_token_pending ON account_merge_request(verification_token) WHERE status = 'PENDING';
```

- [ ] **Step 2: 驗證遷移**

Run: `cd server && mvn flyway:migrate -pl skillhub-app`
Expected: 遷移成功，V4 指令碼執行無錯誤

- [ ] **Step 3: Commit**

```bash
git add server/skillhub-app/src/main/resources/db/migration/V4__phase4_auth_governance.sql
git commit -m "feat(db): add V4 migration for local_credential and account_merge_request"
```

### Task 1.2: PasswordPolicyValidator — 密碼策略校驗

**Files:**
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidator.java`
- Test: `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidatorTest.java`

- [ ] **Step 1: 編寫失敗測試**

```java
package com.iflytek.skillhub.auth.local;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class PasswordPolicyValidatorTest {
    private final PasswordPolicyValidator validator = new PasswordPolicyValidator();

    @Test
    void validPassword_passes() {
        assertThat(validator.validate("Abcdef1!")).isEmpty();
    }

    @Test
    void tooShort_fails() {
        assertThat(validator.validate("Ab1!xyz")).isNotEmpty();
    }

    @Test
    void tooLong_fails() {
        assertThat(validator.validate("A".repeat(129))).isNotEmpty();
    }

    @Test
    void onlyOneCharType_fails() {
        assertThat(validator.validate("abcdefgh")).isNotEmpty();
    }

    @Test
    void twoCharTypes_fails() {
        assertThat(validator.validate("abcdefg1")).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Abcdefg1", "Abcdef1!", "abcdef1!", "ABCDEF1!"})
    void threeCharTypes_passes(String password) {
        assertThat(validator.validate(password)).isEmpty();
    }
}
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=PasswordPolicyValidatorTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: FAIL — 類不存在

- [ ] **Step 3: 實現 PasswordPolicyValidator**

```java
package com.iflytek.skillhub.auth.local;

import java.util.ArrayList;
import java.util.List;

public class PasswordPolicyValidator {
    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 128;
    private static final int MIN_CHAR_TYPES = 3;

    public List<String> validate(String password) {
        var errors = new ArrayList<String>();
        if (password == null || password.length() < MIN_LENGTH) {
            errors.add("password.too_short");
            return errors;
        }
        if (password.length() > MAX_LENGTH) {
            errors.add("password.too_long");
            return errors;
        }
        int types = 0;
        if (password.chars().anyMatch(Character::isUpperCase)) types++;
        if (password.chars().anyMatch(Character::isLowerCase)) types++;
        if (password.chars().anyMatch(Character::isDigit)) types++;
        if (password.chars().anyMatch(c -> !Character.isLetterOrDigit(c))) types++;
        if (types < MIN_CHAR_TYPES) {
            errors.add("password.insufficient_complexity");
        }
        return errors;
    }
}
```

- [ ] **Step 4: 執行測試確認透過**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=PasswordPolicyValidatorTest`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidator.java \
       server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/PasswordPolicyValidatorTest.java
git commit -m "feat(auth): add PasswordPolicyValidator with TDD"
```

### Task 1.3: LocalCredential 實體 + Repository

**Files:**
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredential.java`
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredentialRepository.java`
- Create: `server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/LocalCredentialJpaRepository.java`

- [ ] **Step 1: 建立 LocalCredential 實體**

```java
package com.iflytek.skillhub.auth.local;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "local_credential")
public class LocalCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 64)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected LocalCredential() {}

    public LocalCredential(String userId, String username, String passwordHash) {
        this.userId = userId;
        this.username = username;
        this.passwordHash = passwordHash;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and setters
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
    public LocalDateTime getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(LocalDateTime lockedUntil) { this.lockedUntil = lockedUntil; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public boolean isLocked() {
        return lockedUntil != null && lockedUntil.isAfter(LocalDateTime.now());
    }

    public void recordFailedAttempt(int maxAttempts, int lockMinutes) {
        this.failedAttempts++;
        if (this.failedAttempts >= maxAttempts) {
            this.lockedUntil = LocalDateTime.now().plusMinutes(lockMinutes);
        }
    }

    public void resetFailedAttempts() {
        this.failedAttempts = 0;
        this.lockedUntil = null;
    }
}
```

- [ ] **Step 2: 建立 Repository 介面**

```java
package com.iflytek.skillhub.auth.local;

import java.util.Optional;

public interface LocalCredentialRepository {
    Optional<LocalCredential> findByUsername(String username);
    Optional<LocalCredential> findByUserId(String userId);
    LocalCredential save(LocalCredential credential);
    boolean existsByUsername(String username);
}
```

- [ ] **Step 3: 建立 JPA 實現**

```java
package com.iflytek.skillhub.infra.jpa;

import com.iflytek.skillhub.auth.local.LocalCredential;
import com.iflytek.skillhub.auth.local.LocalCredentialRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface LocalCredentialJpaRepository extends JpaRepository<LocalCredential, Long>, LocalCredentialRepository {
    Optional<LocalCredential> findByUsername(String username);
    Optional<LocalCredential> findByUserId(String userId);
    boolean existsByUsername(String username);
}
```

- [ ] **Step 4: 編譯驗證**

Run: `cd server && mvn compile -pl skillhub-auth,skillhub-infra`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredential.java \
       server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalCredentialRepository.java \
       server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/LocalCredentialJpaRepository.java
git commit -m "feat(auth): add LocalCredential entity and repository"
```

### Task 1.4: LocalAuthService — 註冊/登入/改密

**Files:**
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalAuthService.java`
- Test: `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/LocalAuthServiceTest.java`

- [ ] **Step 1: 編寫註冊測試**

```java
package com.iflytek.skillhub.auth.local;

import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocalAuthServiceTest {
    @Mock private LocalCredentialRepository credentialRepo;
    @Mock private UserAccountRepository userRepo;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4); // 低 strength 加速測試
    private final PasswordPolicyValidator policyValidator = new PasswordPolicyValidator();
    private LocalAuthService service;

    @BeforeEach
    void setUp() {
        service = new LocalAuthService(credentialRepo, userRepo, passwordEncoder, policyValidator);
    }

    @Test
    void register_success() {
        when(credentialRepo.existsByUsername("testuser")).thenReturn(false);
        when(userRepo.save(any())).thenAnswer(inv -> {
            var u = inv.getArgument(0, UserAccount.class);
            return u; // 模擬儲存
        });
        when(credentialRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.register("testuser", "Test@1234", null);
        assertThat(result).isNotNull();
        verify(credentialRepo).save(argThat(c -> c.getUsername().equals("testuser")));
    }

    @Test
    void register_duplicateUsername_throws() {
        when(credentialRepo.existsByUsername("taken")).thenReturn(true);
        assertThatThrownBy(() -> service.register("taken", "Test@1234", null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void register_weakPassword_throws() {
        assertThatThrownBy(() -> service.register("user", "weak", null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=LocalAuthServiceTest`
Expected: FAIL — LocalAuthService 不存在

- [ ] **Step 3: 實現 LocalAuthService**

```java
package com.iflytek.skillhub.auth.local;

import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import com.iflytek.skillhub.domain.user.UserStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

public class LocalAuthService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_MINUTES = 15;

    private final LocalCredentialRepository credentialRepo;
    private final UserAccountRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicyValidator policyValidator;

    public LocalAuthService(LocalCredentialRepository credentialRepo,
                            UserAccountRepository userRepo,
                            PasswordEncoder passwordEncoder,
                            PasswordPolicyValidator policyValidator) {
        this.credentialRepo = credentialRepo;
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.policyValidator = policyValidator;
    }

    @Transactional
    public UserAccount register(String username, String password, String email) {
        var errors = policyValidator.validate(password);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Password policy violation: " + errors);
        }
        if (credentialRepo.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already taken");
        }
        var user = new UserAccount(username, email, null);
        user.setStatus(UserStatus.ACTIVE);
        user = userRepo.save(user);

        var credential = new LocalCredential(user.getId(), username, passwordEncoder.encode(password));
        credentialRepo.save(credential);
        return user;
    }

    @Transactional
    public UserAccount login(String username, String password) {
        var credential = credentialRepo.findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        var user = userRepo.findById(credential.getUserId())
            .orElseThrow(() -> new IllegalStateException("User not found"));

        if (user.getStatus() == UserStatus.DISABLED) {
            throw new IllegalStateException("Account is disabled");
        }
        if (credential.isLocked()) {
            throw new IllegalStateException("Account is locked");
        }
        if (!passwordEncoder.matches(password, credential.getPasswordHash())) {
            credential.recordFailedAttempt(MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
            credentialRepo.save(credential);
            throw new IllegalArgumentException("Invalid username or password");
        }
        credential.resetFailedAttempts();
        credentialRepo.save(credential);
        return user;
    }

    @Transactional
    public void changePassword(String userId, String oldPassword, String newPassword) {
        var credential = credentialRepo.findByUserId(userId)
            .orElseThrow(() -> new IllegalStateException("No local credential"));
        if (!passwordEncoder.matches(oldPassword, credential.getPasswordHash())) {
            throw new IllegalArgumentException("Old password is incorrect");
        }
        var errors = policyValidator.validate(newPassword);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Password policy violation: " + errors);
        }
        credential.setPasswordHash(passwordEncoder.encode(newPassword));
        credentialRepo.save(credential);
    }
}
```

- [ ] **Step 4: 新增登入測試**

在 `LocalAuthServiceTest` 中追加：

```java
@Test
void login_success() {
    var cred = new LocalCredential(1L, "testuser", passwordEncoder.encode("Test@1234"));
    var user = new UserAccount("testuser", null, null);
    when(credentialRepo.findByUsername("testuser")).thenReturn(java.util.Optional.of(cred));
    when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));

    var result = service.login("testuser", "Test@1234");
    assertThat(result).isNotNull();
    verify(credentialRepo).save(argThat(c -> c.getFailedAttempts() == 0));
}

@Test
void login_wrongPassword_incrementsFailedAttempts() {
    var cred = new LocalCredential(1L, "testuser", passwordEncoder.encode("Test@1234"));
    var user = new UserAccount("testuser", null, null);
    when(credentialRepo.findByUsername("testuser")).thenReturn(java.util.Optional.of(cred));
    when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));

    assertThatThrownBy(() -> service.login("testuser", "wrong"))
        .isInstanceOf(IllegalArgumentException.class);
    verify(credentialRepo).save(argThat(c -> c.getFailedAttempts() == 1));
}

@Test
void login_lockedAccount_throws() {
    var cred = new LocalCredential(1L, "testuser", passwordEncoder.encode("Test@1234"));
    cred.setLockedUntil(LocalDateTime.now().plusMinutes(10));
    var user = new UserAccount("testuser", null, null);
    when(credentialRepo.findByUsername("testuser")).thenReturn(java.util.Optional.of(cred));
    when(userRepo.findById(1L)).thenReturn(java.util.Optional.of(user));

    assertThatThrownBy(() -> service.login("testuser", "Test@1234"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("locked");
}
```

- [ ] **Step 5: 執行全部測試**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=LocalAuthServiceTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/local/LocalAuthService.java \
       server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/local/LocalAuthServiceTest.java
git commit -m "feat(auth): add LocalAuthService with register/login/changePassword"
```

### Task 1.5: DTO 類 — 請求/響應物件

**Files:**
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalRegisterRequest.java`
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalLoginRequest.java`
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/ChangePasswordRequest.java`

- [ ] **Step 1: 建立 LocalRegisterRequest**

```java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LocalRegisterRequest(
    @NotBlank @Size(min = 3, max = 64)
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username must contain only letters, digits, underscores")
    String username,

    @NotBlank @Size(min = 8, max = 128)
    String password,

    String email
) {}
```

- [ ] **Step 2: 建立 LocalLoginRequest**

```java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotBlank;

public record LocalLoginRequest(
    @NotBlank String username,
    @NotBlank String password
) {}
```

- [ ] **Step 3: 建立 ChangePasswordRequest**

```java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank String oldPassword,
    @NotBlank @Size(min = 8, max = 128) String newPassword
) {}
```

- [ ] **Step 4: 編譯驗證**

Run: `cd server && mvn compile -pl skillhub-app`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalRegisterRequest.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/LocalLoginRequest.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/ChangePasswordRequest.java
git commit -m "feat(auth): add local auth request DTOs"
```

### Task 1.6: LocalAuthController — 本地認證端點

**Files:**
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/LocalAuthController.java`
- Test: `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/LocalAuthControllerTest.java`

- [ ] **Step 1: 編寫 Controller 測試**

```java
package com.iflytek.skillhub.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iflytek.skillhub.auth.local.LocalAuthService;
import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.dto.LocalRegisterRequest;
import com.iflytek.skillhub.dto.LocalLoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(LocalAuthController.class)
class LocalAuthControllerTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private LocalAuthService localAuthService;

    @Test
    void register_success_returns200() throws Exception {
        var user = new UserAccount("testuser", null, null);
        when(localAuthService.register(eq("testuser"), eq("Test@1234"), isNull()))
            .thenReturn(user);

        mockMvc.perform(post("/api/v1/auth/local/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new LocalRegisterRequest("testuser", "Test@1234", null))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void register_invalidUsername_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/local/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"\",\"password\":\"Test@1234\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void login_success_returns200() throws Exception {
        var user = new UserAccount("testuser", null, null);
        when(localAuthService.login("testuser", "Test@1234")).thenReturn(user);

        mockMvc.perform(post("/api/v1/auth/local/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new LocalLoginRequest("testuser", "Test@1234"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        when(localAuthService.login("testuser", "wrong"))
            .thenThrow(new IllegalArgumentException("Invalid username or password"));

        mockMvc.perform(post("/api/v1/auth/local/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new LocalLoginRequest("testuser", "wrong"))))
            .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd server && mvn test -pl skillhub-app -Dtest=LocalAuthControllerTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: FAIL — LocalAuthController 不存在

- [ ] **Step 3: 實現 LocalAuthController**

```java
package com.iflytek.skillhub.controller;

import com.iflytek.skillhub.auth.local.LocalAuthService;
import com.iflytek.skillhub.dto.ChangePasswordRequest;
import com.iflytek.skillhub.dto.LocalLoginRequest;
import com.iflytek.skillhub.dto.LocalRegisterRequest;
import com.iflytek.skillhub.domain.user.UserAccount;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/local")
public class LocalAuthController {
    private final LocalAuthService localAuthService;

    public LocalAuthController(LocalAuthService localAuthService) {
        this.localAuthService = localAuthService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody LocalRegisterRequest req,
                                       HttpSession session) {
        try {
            var user = localAuthService.register(req.username(), req.password(), req.email());
            session.setAttribute("userId", user.getId());
            return ResponseEntity.ok(Map.of("code", 0, "msg", "註冊成功", "data", Map.of(
                "userId", user.getId(), "displayName", user.getDisplayName())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LocalLoginRequest req,
                                    HttpSession session) {
        try {
            var user = localAuthService.login(req.username(), req.password());
            session.setAttribute("userId", user.getId());
            return ResponseEntity.ok(Map.of("code", 0, "msg", "登入成功", "data", Map.of(
                "userId", user.getId(), "displayName", user.getDisplayName())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", 401, "msg", e.getMessage()));
        } catch (IllegalStateException e) {
            if (e.getMessage().contains("locked")) {
                return ResponseEntity.status(423)
                    .body(Map.of("code", 423, "msg", e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("code", 403, "msg", e.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                             HttpSession session) {
        var userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", 401, "msg", "請先登入"));
        }
        try {
            localAuthService.changePassword(userId, req.oldPassword(), req.newPassword());
            return ResponseEntity.ok(Map.of("code", 0, "msg", "密碼修改成功"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }
}
```

- [ ] **Step 4: 修改 SecurityConfig — 新增本地認證端點 permitAll + BCrypt Bean**

在 `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/config/SecurityConfig.java` 中：

1. 新增 import：
```java
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
```

2. 在 `authorizeHttpRequests` 的 `.permitAll()` 列表中新增：
```java
.requestMatchers(
    "/api/v1/health",
    "/api/v1/auth/providers",
    "/api/v1/auth/me",
    "/api/v1/auth/local/register",  // 新增
    "/api/v1/auth/local/login",     // 新增
    "/actuator/health",
    // ... 其餘不變
).permitAll()
```

3. 新增 BCrypt Bean：
```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
}
```

- [ ] **Step 5: 執行測試**

Run: `cd server && mvn test -pl skillhub-app -Dtest=LocalAuthControllerTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/LocalAuthController.java \
       server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/LocalAuthControllerTest.java \
       server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/config/SecurityConfig.java
git commit -m "feat(auth): add LocalAuthController + SecurityConfig local auth endpoints"
```

### Task 1.7: AccountMergeRequest 實體 + Repository

**Files:**
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequest.java`
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequestRepository.java`
- Create: `server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/AccountMergeRequestJpaRepository.java`

- [ ] **Step 1: 建立 AccountMergeRequest 實體**

```java
package com.iflytek.skillhub.auth.merge;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "account_merge_request")
public class AccountMergeRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "primary_user_id", nullable = false)
    private Long primaryUserId;

    @Column(name = "secondary_user_id", nullable = false)
    private Long secondaryUserId;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @Column(name = "verification_token")
    private String verificationToken;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected AccountMergeRequest() {}

    public AccountMergeRequest(Long primaryUserId, Long secondaryUserId) {
        this.primaryUserId = primaryUserId;
        this.secondaryUserId = secondaryUserId;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public Long getPrimaryUserId() { return primaryUserId; }
    public Long getSecondaryUserId() { return secondaryUserId; }
    public String getStatus() { return status; }
    public String getVerificationToken() { return verificationToken; }
    public LocalDateTime getTokenExpiresAt() { return tokenExpiresAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // Status transitions
    public void setVerificationToken(String token, LocalDateTime expiresAt) {
        this.verificationToken = token;
        this.tokenExpiresAt = expiresAt;
    }

    public void verify() {
        this.status = "VERIFIED";
    }

    public void complete() {
        this.status = "COMPLETED";
        this.completedAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = "CANCELLED";
    }

    public boolean isExpired() {
        return tokenExpiresAt != null && tokenExpiresAt.isBefore(LocalDateTime.now());
    }
}
```

- [ ] **Step 2: 建立 Repository 介面**

```java
package com.iflytek.skillhub.auth.merge;

import java.util.List;
import java.util.Optional;

public interface AccountMergeRequestRepository {
    AccountMergeRequest save(AccountMergeRequest request);
    Optional<AccountMergeRequest> findById(Long id);
    List<AccountMergeRequest> findByPrimaryUserId(Long primaryUserId);
    Optional<AccountMergeRequest> findBySecondaryUserIdAndStatus(Long secondaryUserId, String status);
}
```

- [ ] **Step 3: 建立 JPA 實現**

```java
package com.iflytek.skillhub.infra.jpa;

import com.iflytek.skillhub.auth.merge.AccountMergeRequest;
import com.iflytek.skillhub.auth.merge.AccountMergeRequestRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AccountMergeRequestJpaRepository
        extends JpaRepository<AccountMergeRequest, Long>, AccountMergeRequestRepository {
    List<AccountMergeRequest> findByPrimaryUserId(Long primaryUserId);
    Optional<AccountMergeRequest> findBySecondaryUserIdAndStatus(Long secondaryUserId, String status);
}
```

- [ ] **Step 4: 編譯驗證**

Run: `cd server && mvn compile -pl skillhub-auth,skillhub-infra`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequest.java \
       server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeRequestRepository.java \
       server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/AccountMergeRequestJpaRepository.java
git commit -m "feat(auth): add AccountMergeRequest entity and repository"
```

### Task 1.8: AccountMergeService — 合併服務

**Files:**
- Create: `server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeService.java`
- Test: `server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/merge/AccountMergeServiceTest.java`

- [ ] **Step 1: 編寫測試 — 發起合併**

```java
package com.iflytek.skillhub.auth.merge;

import com.iflytek.skillhub.auth.local.LocalCredentialRepository;
import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountMergeServiceTest {
    @Mock private AccountMergeRequestRepository mergeRepo;
    @Mock private UserAccountRepository userRepo;
    @Mock private LocalCredentialRepository credentialRepo;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private AccountMergeService service;

    @BeforeEach
    void setUp() {
        service = new AccountMergeService(mergeRepo, userRepo, credentialRepo, passwordEncoder);
    }

    @Test
    void initiate_success() {
        when(userRepo.findById(2L)).thenReturn(Optional.of(new UserAccount("secondary", null, null)));
        when(mergeRepo.findBySecondaryUserIdAndStatus(2L, "PENDING")).thenReturn(Optional.empty());
        when(mergeRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.initiate(1L, 2L);
        assertThat(result).isNotNull();
        assertThat(result.getPrimaryUserId()).isEqualTo(1L);
        assertThat(result.getSecondaryUserId()).isEqualTo(2L);
        assertThat(result.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void initiate_selfMerge_throws() {
        assertThatThrownBy(() -> service.initiate(1L, 1L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Cannot merge");
    }

    @Test
    void initiate_duplicatePending_throws() {
        when(userRepo.findById(2L)).thenReturn(Optional.of(new UserAccount("secondary", null, null)));
        when(mergeRepo.findBySecondaryUserIdAndStatus(2L, "PENDING"))
            .thenReturn(Optional.of(new AccountMergeRequest(3L, 2L)));

        assertThatThrownBy(() -> service.initiate(1L, 2L))
            .isInstanceOf(IllegalStateException.class);
    }
}
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=AccountMergeServiceTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: FAIL — AccountMergeService 不存在

- [ ] **Step 3: 實現 AccountMergeService**

```java
package com.iflytek.skillhub.auth.merge;

import com.iflytek.skillhub.auth.local.LocalCredentialRepository;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import com.iflytek.skillhub.domain.user.UserStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

public class AccountMergeService {
    private static final int TOKEN_EXPIRY_MINUTES = 30;

    private final AccountMergeRequestRepository mergeRepo;
    private final UserAccountRepository userRepo;
    private final LocalCredentialRepository credentialRepo;
    private final PasswordEncoder passwordEncoder;

    public AccountMergeService(AccountMergeRequestRepository mergeRepo,
                               UserAccountRepository userRepo,
                               LocalCredentialRepository credentialRepo,
                               PasswordEncoder passwordEncoder) {
        this.mergeRepo = mergeRepo;
        this.userRepo = userRepo;
        this.credentialRepo = credentialRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AccountMergeRequest initiate(Long primaryUserId, Long secondaryUserId) {
        if (primaryUserId.equals(secondaryUserId)) {
            throw new IllegalArgumentException("Cannot merge account with itself");
        }
        userRepo.findById(secondaryUserId)
            .orElseThrow(() -> new IllegalArgumentException("Secondary user not found"));

        mergeRepo.findBySecondaryUserIdAndStatus(secondaryUserId, "PENDING")
            .ifPresent(r -> { throw new IllegalStateException("Pending merge already exists"); });

        var rawToken = UUID.randomUUID().toString();
        var request = new AccountMergeRequest(primaryUserId, secondaryUserId);
        request.setVerificationToken(
            passwordEncoder.encode(rawToken),
            LocalDateTime.now().plusMinutes(TOKEN_EXPIRY_MINUTES));
        return mergeRepo.save(request);
    }

    @Transactional
    public void verify(Long requestId, String token) {
        var request = mergeRepo.findById(requestId)
            .orElseThrow(() -> new IllegalArgumentException("Merge request not found"));
        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Request is not pending");
        }
        if (request.isExpired()) {
            request.cancel();
            mergeRepo.save(request);
            throw new IllegalStateException("Verification token expired");
        }
        if (!passwordEncoder.matches(token, request.getVerificationToken())) {
            throw new IllegalArgumentException("Invalid verification token");
        }
        request.verify();
        mergeRepo.save(request);
    }

    @Transactional
    public void confirm(Long requestId) {
        var request = mergeRepo.findById(requestId)
            .orElseThrow(() -> new IllegalArgumentException("Merge request not found"));
        if (!"VERIFIED".equals(request.getStatus())) {
            throw new IllegalStateException("Request is not verified");
        }
        // 資料遷移邏輯（技能、收藏、角色等）在此擴充套件
        var secondaryUser = userRepo.findById(request.getSecondaryUserId())
            .orElseThrow(() -> new IllegalStateException("Secondary user not found"));
        secondaryUser.setStatus(UserStatus.MERGED);
        secondaryUser.setMergedToUserId(request.getPrimaryUserId());
        userRepo.save(secondaryUser);

        request.complete();
        mergeRepo.save(request);
    }

    @Transactional
    public void cancel(Long requestId, String userId) {
        var request = mergeRepo.findById(requestId)
            .orElseThrow(() -> new IllegalArgumentException("Merge request not found"));
        if (!request.getPrimaryUserId().equals(userId)) {
            throw new IllegalArgumentException("Only primary user can cancel");
        }
        if ("COMPLETED".equals(request.getStatus())) {
            throw new IllegalStateException("Cannot cancel completed merge");
        }
        request.cancel();
        mergeRepo.save(request);
    }
}
```

- [ ] **Step 4: 執行測試**

Run: `cd server && mvn test -pl skillhub-auth -Dtest=AccountMergeServiceTest`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/merge/AccountMergeService.java \
       server/skillhub-auth/src/test/java/com/iflytek/skillhub/auth/merge/AccountMergeServiceTest.java
git commit -m "feat(auth): add AccountMergeService with initiate/verify/confirm/cancel"
```

### Task 1.9: AccountMergeController + 合併 DTO

**Files:**
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeInitiateRequest.java`
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeVerifyRequest.java`
- Create: `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/AccountMergeController.java`
- Test: `server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/AccountMergeControllerTest.java`

- [ ] **Step 1: 建立合併 DTO**

```java
// MergeInitiateRequest.java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotNull;

public record MergeInitiateRequest(
    @NotNull Long secondaryUserId
) {}
```

```java
// MergeVerifyRequest.java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotBlank;

public record MergeVerifyRequest(
    @NotBlank String token
) {}
```

- [ ] **Step 2: 編寫 Controller 測試**

```java
package com.iflytek.skillhub.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iflytek.skillhub.auth.merge.AccountMergeRequest;
import com.iflytek.skillhub.auth.merge.AccountMergeService;
import com.iflytek.skillhub.dto.MergeInitiateRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AccountMergeController.class)
class AccountMergeControllerTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private AccountMergeService mergeService;

    @Test
    void initiate_success() throws Exception {
        var session = new MockHttpSession();
        session.setAttribute("userId", 1L);
        var mergeReq = new AccountMergeRequest(1L, 2L);
        when(mergeService.initiate(1L, 2L)).thenReturn(mergeReq);

        mockMvc.perform(post("/api/v1/auth/merge/initiate")
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new MergeInitiateRequest(2L))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void initiate_notLoggedIn_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/merge/initiate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new MergeInitiateRequest(2L))))
            .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `cd server && mvn test -pl skillhub-app -Dtest=AccountMergeControllerTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: FAIL — AccountMergeController 不存在

- [ ] **Step 4: 實現 AccountMergeController**

```java
package com.iflytek.skillhub.controller;

import com.iflytek.skillhub.auth.merge.AccountMergeService;
import com.iflytek.skillhub.dto.MergeInitiateRequest;
import com.iflytek.skillhub.dto.MergeVerifyRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/merge")
public class AccountMergeController {
    private final AccountMergeService mergeService;

    public AccountMergeController(AccountMergeService mergeService) {
        this.mergeService = mergeService;
    }

    @PostMapping("/initiate")
    public ResponseEntity<?> initiate(@Valid @RequestBody MergeInitiateRequest req,
                                       HttpSession session) {
        var userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", 401, "msg", "請先登入"));
        }
        try {
            var result = mergeService.initiate(userId, req.secondaryUserId());
            return ResponseEntity.ok(Map.of("code", 0, "msg", "合併請求已建立",
                "data", Map.of("requestId", result.getId())));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/verify")
    public ResponseEntity<?> verify(@PathVariable Long requestId,
                                     @Valid @RequestBody MergeVerifyRequest req) {
        try {
            mergeService.verify(requestId, req.token());
            return ResponseEntity.ok(Map.of("code", 0, "msg", "驗證成功"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/confirm")
    public ResponseEntity<?> confirm(@PathVariable Long requestId, HttpSession session) {
        var userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", 401, "msg", "請先登入"));
        }
        try {
            mergeService.confirm(requestId);
            return ResponseEntity.ok(Map.of("code", 0, "msg", "合併完成"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long requestId, HttpSession session) {
        var userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("code", 401, "msg", "請先登入"));
        }
        try {
            mergeService.cancel(requestId, userId);
            return ResponseEntity.ok(Map.of("code", 0, "msg", "合併已取消"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("code", 400, "msg", e.getMessage()));
        }
    }
}
```

- [ ] **Step 5: 執行測試**

Run: `cd server && mvn test -pl skillhub-app -Dtest=AccountMergeControllerTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeInitiateRequest.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/MergeVerifyRequest.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/AccountMergeController.java \
       server/skillhub-app/src/test/java/com/iflytek/skillhub/controller/AccountMergeControllerTest.java
git commit -m "feat(auth): add AccountMergeController with initiate/verify/confirm/cancel"
```

---

### Task 1.10: SeedDataRunner — Docker 環境種子資料

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/config/SeedDataRunner.java`

**步驟:**

- [ ] **Step 1: 實現 SeedDataRunner**

```java
package com.iflytek.skillhub.config;

import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("docker")
public class SeedDataRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDataRunner.class);
    private final UserAccountRepository userRepo;
    private final PasswordEncoder encoder;

    public SeedDataRunner(UserAccountRepository userRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) {
            log.info("Seed data already exists, skipping.");
            return;
        }
        UserAccount admin = new UserAccount();
        admin.setUsername("admin");
        admin.setPasswordHash(encoder.encode("Admin@2026"));
        admin.setDisplayName("Administrator");
        admin.setStatus("ACTIVE");
        userRepo.save(admin);

        UserAccount demo = new UserAccount();
        demo.setUsername("demo");
        demo.setPasswordHash(encoder.encode("Demo@2026"));
        demo.setDisplayName("Demo User");
        demo.setStatus("ACTIVE");
        userRepo.save(demo);

        log.info("Seed data created: admin, demo");
    }
}
```

- [ ] **Step 2: 新增 docker profile 配置**

在 `application.yml` 中新增:
```yaml
---
spring:
  config:
    activate:
      on-profile: docker
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:skillhub}
    username: ${DB_USER:skillhub}
    password: ${DB_PASS:skillhub}
```

- [ ] **Step 3: 驗證編譯透過**

Run: `cd server && mvn compile -pl skillhub-app`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/config/SeedDataRunner.java \
       server/skillhub-app/src/main/resources/application.yml
git commit -m "feat(ops): add SeedDataRunner for docker profile with admin/demo users"
```

---

## Chunk 2: Skill 治理 + 審計日誌 + Prometheus 指標

### Task 2.1: AuditLog Entity + Repository

**檔案:**
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditLog.java`
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditLogRepository.java`
- `server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/AuditLogJpaRepository.java`
- `server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/audit/AuditLogTest.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.domain.audit;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AuditLogTest {

    @Test
    void shouldCreateAuditLog() {
        AuditLog log = AuditLog.of("user-1", "SKILL_PUBLISH",
                "skill-1", "Skill", "Published version 1.0.0");
        assertThat(log.getUserId()).isEqualTo("user-1");
        assertThat(log.getAction()).isEqualTo("SKILL_PUBLISH");
        assertThat(log.getTargetId()).isEqualTo("skill-1");
        assertThat(log.getTargetType()).isEqualTo("Skill");
        assertThat(log.getDetail()).isEqualTo("Published version 1.0.0");
        assertThat(log.getCreatedAt()).isNotNull();
    }

    @Test
    void shouldCreateWithoutDetail() {
        AuditLog log = AuditLog.of("user-1", "USER_LOGIN", null, null, null);
        assertThat(log.getAction()).isEqualTo("USER_LOGIN");
        assertThat(log.getTargetId()).isNull();
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=AuditLogTest`
Expected: COMPILATION FAILURE

- [ ] **Step 3: 實現 AuditLog Entity**

```java
package com.iflytek.skillhub.domain.audit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
public class AuditLog {
    @Id
    private String id;
    private String userId;
    private String action;
    private String targetId;
    private String targetType;

    @Column(length = 2000)
    private String detail;
    private Instant createdAt;

    protected AuditLog() {}

    public static AuditLog of(String userId, String action,
                               String targetId, String targetType, String detail) {
        AuditLog log = new AuditLog();
        log.id = UUID.randomUUID().toString();
        log.userId = userId;
        log.action = action;
        log.targetId = targetId;
        log.targetType = targetType;
        log.detail = detail;
        log.createdAt = Instant.now();
        return log;
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getAction() { return action; }
    public String getTargetId() { return targetId; }
    public String getTargetType() { return targetType; }
    public String getDetail() { return detail; }
    public Instant getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 4: 實現 Repository**

```java
package com.iflytek.skillhub.domain.audit;

import java.time.Instant;
import java.util.List;

public interface AuditLogRepository {
    AuditLog save(AuditLog log);
    List<AuditLog> findByUserId(String userId);
    List<AuditLog> findByTargetId(String targetId);
    List<AuditLog> findByActionAndCreatedAtAfter(String action, Instant after);
}
```

JPA 實現:
```java
package com.iflytek.skillhub.infra.jpa;

import com.iflytek.skillhub.domain.audit.AuditLog;
import com.iflytek.skillhub.domain.audit.AuditLogRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface AuditLogJpaRepository
        extends JpaRepository<AuditLog, String>, AuditLogRepository {
    List<AuditLog> findByUserId(String userId);
    List<AuditLog> findByTargetId(String targetId);
    List<AuditLog> findByActionAndCreatedAtAfter(String action, Instant after);
}
```

- [ ] **Step 5: 執行測試**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=AuditLogTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/ \
       server/skillhub-infra/src/main/java/com/iflytek/skillhub/infra/jpa/AuditLogJpaRepository.java \
       server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/audit/AuditLogTest.java
git commit -m "feat(audit): add AuditLog entity and repository"
```

---

### Task 2.2: AuditService + 關鍵操作埋點

**檔案:**
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditService.java`
- `server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/audit/AuditServiceTest.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.domain.audit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditServiceTest {

    private AuditLogRepository repo;
    private AuditService service;

    @BeforeEach
    void setUp() {
        repo = mock(AuditLogRepository.class);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new AuditService(repo);
    }

    @Test
    void shouldLogAction() {
        service.log("user-1", "SKILL_PUBLISH", "skill-1", "Skill", "v1.0");
        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue().getAction()).isEqualTo("SKILL_PUBLISH");
    }

    @Test
    void shouldLogWithoutTarget() {
        service.log("user-1", "USER_LOGIN", null, null, null);
        verify(repo).save(any());
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=AuditServiceTest`
Expected: COMPILATION FAILURE

- [ ] **Step 3: 實現 AuditService**

```java
package com.iflytek.skillhub.domain.audit;

import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    public void log(String userId, String action,
                    String targetId, String targetType, String detail) {
        repository.save(AuditLog.of(userId, action, targetId, targetType, detail));
    }
}
```

- [ ] **Step 4: 執行測試**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=AuditServiceTest`
Expected: ALL PASS

- [ ] **Step 5: 在關鍵 Controller 中埋點**

在以下位置新增 `auditService.log(...)` 呼叫:
- `LocalAuthController.register()` → action: `USER_REGISTER`
- `LocalAuthController.login()` → action: `USER_LOGIN`
- `SkillPublishController.publish()` → action: `SKILL_PUBLISH`
- `AccountMergeController.confirm()` → action: `ACCOUNT_MERGE`

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/audit/AuditService.java \
       server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/audit/AuditServiceTest.java
git commit -m "feat(audit): add AuditService and embed audit logging in key operations"
```

---

### Task 2.3: Flyway V4 — audit_log + skill_deprecation 表

**檔案:**
- `server/skillhub-app/src/main/resources/db/migration/V4__phase4_audit_governance.sql`

**步驟:**

- [ ] **Step 1: 建立遷移指令碼**

```sql
-- V4__phase4_audit_governance.sql

-- 審計日誌表
CREATE TABLE audit_log (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36),
    action      VARCHAR(64)  NOT NULL,
    target_id   VARCHAR(36),
    target_type VARCHAR(64),
    detail      VARCHAR(2000),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user    ON audit_log(user_id);
CREATE INDEX idx_audit_log_action  ON audit_log(action, created_at);
CREATE INDEX idx_audit_log_target  ON audit_log(target_id);

-- Skill 廢棄標記欄位
ALTER TABLE skill ADD COLUMN IF NOT EXISTS deprecated    BOOLEAN DEFAULT FALSE;
ALTER TABLE skill ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE skill ADD COLUMN IF NOT EXISTS deprecated_by VARCHAR(36);
ALTER TABLE skill ADD COLUMN IF NOT EXISTS deprecation_reason VARCHAR(500);

-- 賬號合併請求表
CREATE TABLE account_merge_request (
    id                VARCHAR(36) PRIMARY KEY,
    primary_user_id   VARCHAR(36) NOT NULL,
    secondary_user_id VARCHAR(36) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verification_token VARCHAR(255),
    token_expires_at  TIMESTAMP WITH TIME ZONE,
    completed_at      TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 使用者表擴充套件: 本地認證欄位
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS password_hash    VARCHAR(255);
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS failed_attempts  INT DEFAULT 0;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS locked_until     TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS merged_to_user_id VARCHAR(36);
```

- [ ] **Step 2: 驗證遷移**

Run: `cd server && mvn flyway:migrate -pl skillhub-app -Dflyway.configFiles=src/main/resources/application.yml`
或在應用啟動時自動執行。

- [ ] **Step 3: Commit**

```bash
git add server/skillhub-app/src/main/resources/db/migration/V4__phase4_audit_governance.sql
git commit -m "feat(db): add V4 migration for audit_log, skill deprecation, account merge"
```

---

### Task 2.4: Skill 廢棄 (Deprecation) 功能

**檔案:**
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceService.java`
- `server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceServiceTest.java`
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/portal/SkillGovernanceController.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.domain.skill.service;

import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillRepository;
import com.iflytek.skillhub.domain.audit.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SkillGovernanceServiceTest {

    private SkillRepository skillRepo;
    private AuditService auditService;
    private SkillGovernanceService service;

    @BeforeEach
    void setUp() {
        skillRepo = mock(SkillRepository.class);
        auditService = mock(AuditService.class);
        service = new SkillGovernanceService(skillRepo, auditService);
    }

    @Test
    void shouldDeprecateSkill() {
        Skill skill = mock(Skill.class);
        when(skill.getId()).thenReturn("s1");
        when(skillRepo.findById("s1")).thenReturn(Optional.of(skill));
        service.deprecate("s1", "user-1", "Replaced by new-skill");
        verify(skill).deprecate("user-1", "Replaced by new-skill");
        verify(skillRepo).save(skill);
        verify(auditService).log(eq("user-1"), eq("SKILL_DEPRECATE"),
                eq("s1"), eq("Skill"), anyString());
    }

    @Test
    void shouldUndeprecateSkill() {
        Skill skill = mock(Skill.class);
        when(skill.getId()).thenReturn("s1");
        when(skillRepo.findById("s1")).thenReturn(Optional.of(skill));
        service.undeprecate("s1", "user-1");
        verify(skill).undeprecate();
        verify(skillRepo).save(skill);
    }

    @Test
    void shouldThrowWhenSkillNotFound() {
        when(skillRepo.findById("s1")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deprecate("s1", "u1", "reason"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=SkillGovernanceServiceTest`
Expected: COMPILATION FAILURE

- [ ] **Step 3: 在 Skill Entity 中新增廢棄方法**

在 `Skill.java` 中新增:
```java
private boolean deprecated;
private Instant deprecatedAt;
private String deprecatedBy;
private String deprecationReason;

public void deprecate(String userId, String reason) {
    this.deprecated = true;
    this.deprecatedAt = Instant.now();
    this.deprecatedBy = userId;
    this.deprecationReason = reason;
}

public void undeprecate() {
    this.deprecated = false;
    this.deprecatedAt = null;
    this.deprecatedBy = null;
    this.deprecationReason = null;
}

public boolean isDeprecated() { return deprecated; }
public String getDeprecationReason() { return deprecationReason; }
```

- [ ] **Step 4: 實現 SkillGovernanceService**

```java
package com.iflytek.skillhub.domain.skill.service;

import com.iflytek.skillhub.domain.audit.AuditService;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillGovernanceService {

    private final SkillRepository skillRepo;
    private final AuditService auditService;

    public SkillGovernanceService(SkillRepository skillRepo, AuditService auditService) {
        this.skillRepo = skillRepo;
        this.auditService = auditService;
    }

    @Transactional
    public void deprecate(String skillId, String userId, String reason) {
        Skill skill = skillRepo.findById(skillId)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + skillId));
        skill.deprecate(userId, reason);
        skillRepo.save(skill);
        auditService.log(userId, "SKILL_DEPRECATE", skillId, "Skill", reason);
    }

    @Transactional
    public void undeprecate(String skillId, String userId) {
        Skill skill = skillRepo.findById(skillId)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + skillId));
        skill.undeprecate();
        skillRepo.save(skill);
        auditService.log(userId, "SKILL_UNDEPRECATE", skillId, "Skill", null);
    }
}
```

- [ ] **Step 5: 執行測試**

Run: `cd server && mvn test -pl skillhub-domain -Dtest=SkillGovernanceServiceTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/Skill.java \
       server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceService.java \
       server/skillhub-domain/src/test/java/com/iflytek/skillhub/domain/skill/service/SkillGovernanceServiceTest.java
git commit -m "feat(governance): add skill deprecation/undeprecation with audit logging"
```

---

### Task 2.5: Prometheus 指標 + Actuator 配置

**檔案:**
- `server/skillhub-app/pom.xml` (新增 micrometer 依賴)
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/metrics/SkillHubMetrics.java`
- `server/skillhub-app/src/main/resources/application.yml` (actuator 配置)

**步驟:**

- [ ] **Step 1: 新增 Maven 依賴**

在 `skillhub-app/pom.xml` 的 `<dependencies>` 中新增:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

- [ ] **Step 2: 配置 Actuator**

在 `application.yml` 中新增:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  endpoint:
    health:
      show-details: when-authorized
  metrics:
    tags:
      application: skillhub
```

- [ ] **Step 3: 實現自定義指標**

```java
package com.iflytek.skillhub.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class SkillHubMetrics {

    private final Counter skillPublishCounter;
    private final Counter userRegisterCounter;
    private final Counter loginSuccessCounter;
    private final Counter loginFailureCounter;

    public SkillHubMetrics(MeterRegistry registry) {
        this.skillPublishCounter = Counter.builder("skillhub.skill.publish")
                .description("Number of skill publications")
                .register(registry);
        this.userRegisterCounter = Counter.builder("skillhub.user.register")
                .description("Number of user registrations")
                .register(registry);
        this.loginSuccessCounter = Counter.builder("skillhub.auth.login.success")
                .description("Successful logins")
                .register(registry);
        this.loginFailureCounter = Counter.builder("skillhub.auth.login.failure")
                .description("Failed logins")
                .register(registry);
    }

    public void incrementSkillPublish() { skillPublishCounter.increment(); }
    public void incrementUserRegister() { userRegisterCounter.increment(); }
    public void incrementLoginSuccess() { loginSuccessCounter.increment(); }
    public void incrementLoginFailure() { loginFailureCounter.increment(); }
}
```

- [ ] **Step 4: 在 Controller 中埋點**

在 `LocalAuthController` 的 login/register 方法中呼叫對應 metrics 方法。
在 `SkillPublishController` 的 publish 方法中呼叫 `metrics.incrementSkillPublish()`。

- [ ] **Step 5: 驗證 Actuator 端點**

啟動應用後訪問: `GET /actuator/prometheus`
Expected: 返回 Prometheus 格式的指標資料，包含 `skillhub_skill_publish_total` 等。

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-app/pom.xml \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/metrics/SkillHubMetrics.java \
       server/skillhub-app/src/main/resources/application.yml
git commit -m "feat(ops): add Prometheus metrics with Actuator and custom counters"
```

---

### Task 2.6: SkillGovernanceController REST API

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/portal/SkillGovernanceController.java`
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/DeprecateRequest.java`

**步驟:**

- [ ] **Step 1: 實現 DTO**

```java
package com.iflytek.skillhub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeprecateRequest(
    @NotBlank @Size(max = 500) String reason
) {}
```

- [ ] **Step 2: 實現 Controller**

```java
package com.iflytek.skillhub.controller.portal;

import com.iflytek.skillhub.controller.BaseApiController;
import com.iflytek.skillhub.dto.DeprecateRequest;
import com.iflytek.skillhub.domain.skill.service.SkillGovernanceService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/skills/{skillId}/governance")
public class SkillGovernanceController extends BaseApiController {

    private final SkillGovernanceService governanceService;

    public SkillGovernanceController(SkillGovernanceService governanceService) {
        this.governanceService = governanceService;
    }

    @PostMapping("/deprecate")
    public ResponseEntity<Map<String, Object>> deprecate(
            @PathVariable String skillId,
            @Valid @RequestBody DeprecateRequest req,
            HttpSession session) {
        String userId = (String) session.getAttribute("userId");
        governanceService.deprecate(skillId, userId, req.reason());
        return ok(Map.of("deprecated", true));
    }

    @PostMapping("/undeprecate")
    public ResponseEntity<Map<String, Object>> undeprecate(
            @PathVariable String skillId,
            HttpSession session) {
        String userId = (String) session.getAttribute("userId");
        governanceService.undeprecate(skillId, userId);
        return ok(Map.of("deprecated", false));
    }
}
```

- [ ] **Step 3: 驗證編譯**

Run: `cd server && mvn compile -pl skillhub-app`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/DeprecateRequest.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/portal/SkillGovernanceController.java
git commit -m "feat(governance): add SkillGovernanceController with deprecate/undeprecate endpoints"
```

---

## Chunk 3: 效能最佳化 + 安全加固

### Task 3.1: HTTP 快取頭 + ETag 支援

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/filter/CacheControlFilter.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/filter/CacheControlFilterTest.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;

class CacheControlFilterTest {

    @Test
    void shouldAddCacheHeadersForSkillDownload() throws Exception {
        CacheControlFilter filter = new CacheControlFilter();
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse resp = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn("/api/v1/skills/s1/versions/1.0/download");
        when(req.getMethod()).thenReturn("GET");
        filter.doFilterInternal(req, resp, chain);
        verify(resp).setHeader("Cache-Control", "public, max-age=86400, immutable");
        verify(chain).doFilter(req, resp);
    }

    @Test
    void shouldNotCacheApiMutations() throws Exception {
        CacheControlFilter filter = new CacheControlFilter();
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse resp = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn("/api/v1/skills");
        when(req.getMethod()).thenReturn("POST");
        filter.doFilterInternal(req, resp, chain);
        verify(resp, never()).setHeader(eq("Cache-Control"), anyString());
        verify(chain).doFilter(req, resp);
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-app -Dtest=CacheControlFilterTest`
Expected: COMPILATION FAILURE

- [ ] **Step 3: 實現 CacheControlFilter**

```java
package com.iflytek.skillhub.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class CacheControlFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                     HttpServletResponse resp,
                                     FilterChain chain)
            throws ServletException, IOException {
        String uri = req.getRequestURI();
        String method = req.getMethod();
        if ("GET".equals(method) && uri.contains("/download")) {
            resp.setHeader("Cache-Control", "public, max-age=86400, immutable");
        } else if ("GET".equals(method) && uri.startsWith("/api/")) {
            resp.setHeader("Cache-Control", "no-cache");
        }
        chain.doFilter(req, resp);
    }
}
```

- [ ] **Step 4: 執行測試**

Run: `cd server && mvn test -pl skillhub-app -Dtest=CacheControlFilterTest`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/filter/CacheControlFilter.java \
       server/skillhub-app/src/test/java/com/iflytek/skillhub/filter/CacheControlFilterTest.java
git commit -m "feat(perf): add CacheControlFilter with immutable download caching"
```

---

### Task 3.2: CORS 配置 + Security Headers

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/config/CorsConfig.java`
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/filter/SecurityHeadersFilter.java`
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/filter/SecurityHeadersFilterTest.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;

class SecurityHeadersFilterTest {

    @Test
    void shouldAddSecurityHeaders() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter();
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse resp = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        filter.doFilterInternal(req, resp, chain);
        verify(resp).setHeader("X-Content-Type-Options", "nosniff");
        verify(resp).setHeader("X-Frame-Options", "DENY");
        verify(resp).setHeader("X-XSS-Protection", "1; mode=block");
        verify(resp).setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        verify(chain).doFilter(req, resp);
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-app -Dtest=SecurityHeadersFilterTest`
Expected: COMPILATION FAILURE

- [ ] **Step 3: 實現 SecurityHeadersFilter**

```java
package com.iflytek.skillhub.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                     HttpServletResponse resp,
                                     FilterChain chain)
            throws ServletException, IOException {
        resp.setHeader("X-Content-Type-Options", "nosniff");
        resp.setHeader("X-Frame-Options", "DENY");
        resp.setHeader("X-XSS-Protection", "1; mode=block");
        resp.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        chain.doFilter(req, resp);
    }
}
```

- [ ] **Step 4: 實現 CorsConfig**

```java
package com.iflytek.skillhub.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

@Configuration
public class CorsConfig {

    @Value("${skillhub.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

- [ ] **Step 5: 執行測試**

Run: `cd server && mvn test -pl skillhub-app -Dtest=SecurityHeadersFilterTest`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/config/CorsConfig.java \
       server/skillhub-app/src/main/java/com/iflytek/skillhub/filter/SecurityHeadersFilter.java \
       server/skillhub-app/src/test/java/com/iflytek/skillhub/filter/SecurityHeadersFilterTest.java
git commit -m "feat(security): add CORS config and security response headers"
```

---

### Task 3.3: Redis RateLimiter 增強 + 配置外部化

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/ratelimit/RateLimitConfig.java`
- `server/skillhub-app/src/main/resources/application.yml` (rate limit 配置)

**步驟:**

- [ ] **Step 1: 實現 RateLimitConfig**

```java
package com.iflytek.skillhub.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@ConfigurationProperties(prefix = "skillhub.rate-limit")
public class RateLimitConfig {

    private int defaultMaxRequests = 60;
    private int defaultWindowSeconds = 60;
    private int publishMaxRequests = 10;
    private int publishWindowSeconds = 3600;

    @Bean
    public RateLimiter rateLimiter(StringRedisTemplate redisTemplate) {
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            return new RedisSlidingWindowRateLimiter(redisTemplate);
        } catch (Exception e) {
            return new InMemorySlidingWindowRateLimiter();
        }
    }

    public int getDefaultMaxRequests() { return defaultMaxRequests; }
    public void setDefaultMaxRequests(int v) { this.defaultMaxRequests = v; }
    public int getDefaultWindowSeconds() { return defaultWindowSeconds; }
    public void setDefaultWindowSeconds(int v) { this.defaultWindowSeconds = v; }
    public int getPublishMaxRequests() { return publishMaxRequests; }
    public void setPublishMaxRequests(int v) { this.publishMaxRequests = v; }
    public int getPublishWindowSeconds() { return publishWindowSeconds; }
    public void setPublishWindowSeconds(int v) { this.publishWindowSeconds = v; }
}
```

- [ ] **Step 2: 新增配置項**

在 `application.yml` 中新增:
```yaml
skillhub:
  rate-limit:
    default-max-requests: 60
    default-window-seconds: 60
    publish-max-requests: 10
    publish-window-seconds: 3600
  cors:
    allowed-origins: http://localhost:5173
```

- [ ] **Step 3: 驗證編譯**

Run: `cd server && mvn compile -pl skillhub-app`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/ratelimit/RateLimitConfig.java \
       server/skillhub-app/src/main/resources/application.yml
git commit -m "feat(ops): externalize rate limit config with Redis/InMemory fallback"
```

---

### Task 3.4: 請求引數校驗 + 全域性異常處理增強

**檔案:**
- `server/skillhub-app/src/main/java/com/iflytek/skillhub/exception/GlobalExceptionHandler.java` (增強)
- `server/skillhub-app/src/test/java/com/iflytek/skillhub/exception/GlobalExceptionHandlerTest.java`

**步驟:**

- [ ] **Step 1: 寫失敗測試**

```java
package com.iflytek.skillhub.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldHandleValidationErrors() {
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        BindingResult br = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(br);
        when(br.getFieldErrors()).thenReturn(List.of(
                new FieldError("req", "username", "must not be blank")
        ));
        ResponseEntity<Map<String, Object>> resp = handler.handleValidation(ex);
        assertThat(resp.getStatusCode().value()).isEqualTo(400);
        Map<String, Object> body = resp.getBody();
        assertThat(body.get("code")).isEqualTo(400);
        assertThat(body.get("msg")).asString().contains("username");
    }

    @Test
    void shouldHandleDomainBadRequest() {
        var ex = new com.iflytek.skillhub.domain.shared.exception.DomainBadRequestException("bad");
        ResponseEntity<Map<String, Object>> resp = handler.handleDomainBadRequest(ex);
        assertThat(resp.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void shouldHandleDomainForbidden() {
        var ex = new com.iflytek.skillhub.domain.shared.exception.DomainForbiddenException("forbidden");
        ResponseEntity<Map<String, Object>> resp = handler.handleDomainForbidden(ex);
        assertThat(resp.getStatusCode().value()).isEqualTo(403);
    }
}
```

- [ ] **Step 2: 驗證測試失敗**

Run: `cd server && mvn test -pl skillhub-app -Dtest=GlobalExceptionHandlerTest`
Expected: COMPILATION FAILURE (新方法不存在)

- [ ] **Step 3: 增強 GlobalExceptionHandler**

在現有 `GlobalExceptionHandler.java` 中新增:
```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    String errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining("; "));
    return ResponseEntity.badRequest().body(Map.of(
            "code", 400, "msg", errors, "timestamp", Instant.now().toString()));
}

@ExceptionHandler(DomainBadRequestException.class)
public ResponseEntity<Map<String, Object>> handleDomainBadRequest(DomainBadRequestException ex) {
    return ResponseEntity.badRequest().body(Map.of(
            "code", 400, "msg", ex.getMessage(), "timestamp", Instant.now().toString()));
}

@ExceptionHandler(DomainForbiddenException.class)
public ResponseEntity<Map<String, Object>> handleDomainForbidden(DomainForbiddenException ex) {
    return ResponseEntity.status(403).body(Map.of(
            "code", 403, "msg", ex.getMessage(), "timestamp", Instant.now().toString()));
}

@ExceptionHandler(Exception.class)
public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(500).body(Map.of(
            "code", 500, "msg", "Internal server error", "timestamp", Instant.now().toString()));
}
```

- [ ] **Step 4: 執行測試**

Run: `cd server && mvn test -pl skillhub-app -Dtest=GlobalExceptionHandlerTest`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add server/skillhub-app/src/main/java/com/iflytek/skillhub/exception/GlobalExceptionHandler.java \
       server/skillhub-app/src/test/java/com/iflytek/skillhub/exception/GlobalExceptionHandlerTest.java
git commit -m "feat(security): enhance GlobalExceptionHandler with validation and domain errors"
```

---

### Task 3.5: 資料庫查詢最佳化 — 索引 + 分頁

**檔案:**
- `server/skillhub-app/src/main/resources/db/migration/V5__performance_indexes.sql`
- `server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/SkillRepository.java` (增加分頁方法)

**步驟:**

- [ ] **Step 1: 建立索引遷移指令碼**

```sql
-- V5__performance_indexes.sql

-- Skill 查詢最佳化
CREATE INDEX IF NOT EXISTS idx_skill_namespace_id ON skill(namespace_id);
CREATE INDEX IF NOT EXISTS idx_skill_name ON skill(name);
CREATE INDEX IF NOT EXISTS idx_skill_deprecated ON skill(deprecated) WHERE deprecated = true;

-- SkillVersion 查詢最佳化
CREATE INDEX IF NOT EXISTS idx_skill_version_skill_id ON skill_version(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_version_created ON skill_version(created_at DESC);

-- NamespaceMember 查詢最佳化
CREATE INDEX IF NOT EXISTS idx_ns_member_user ON namespace_member(user_id);
CREATE INDEX IF NOT EXISTS idx_ns_member_ns ON namespace_member(namespace_id);

-- ReviewTask 查詢最佳化
CREATE INDEX IF NOT EXISTS idx_review_task_status ON review_task(status);
CREATE INDEX IF NOT EXISTS idx_review_task_reviewer ON review_task(reviewer_id);

-- ApiToken 查詢最佳化
CREATE INDEX IF NOT EXISTS idx_api_token_user ON api_token(user_id);
CREATE INDEX IF NOT EXISTS idx_api_token_hash ON api_token(token_hash);

-- 全文搜尋最佳化
CREATE INDEX IF NOT EXISTS idx_search_doc_tsv ON skill_search_document USING gin(search_vector);
```

- [ ] **Step 2: 在 SkillRepository 中新增分頁支援**

```java
// 在 SkillRepository 介面中新增:
Page<Skill> findByNamespaceId(String namespaceId, Pageable pageable);
Page<Skill> findByDeprecatedFalse(Pageable pageable);
```

- [ ] **Step 3: 驗證遷移**

Run: `cd server && mvn compile -pl skillhub-app`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add server/skillhub-app/src/main/resources/db/migration/V5__performance_indexes.sql \
       server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/SkillRepository.java
git commit -m "feat(perf): add database indexes and pagination support"
```

---

## Chunk 4: Docker 一鍵啟動 + 開源基礎設施

### Task 4.1: Dockerfile — 多階段構建

**檔案:**
- `server/Dockerfile`

**步驟:**

- [ ] **Step 1: 建立 Dockerfile**

```dockerfile
# ---- Build Stage ----
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY skillhub-domain/pom.xml skillhub-domain/
COPY skillhub-auth/pom.xml skillhub-auth/
COPY skillhub-search/pom.xml skillhub-search/
COPY skillhub-infra/pom.xml skillhub-infra/
COPY skillhub-app/pom.xml skillhub-app/
RUN mvn dependency:go-offline -B

COPY . .
RUN mvn package -DskipTests -B

# ---- Runtime Stage ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=build /app/skillhub-app/target/skillhub-app-*.jar app.jar

RUN chown -R app:app /app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 2: 建立 .dockerignore**

```
**/target/
**/.idea/
**/*.iml
.git/
```

- [ ] **Step 3: 驗證構建**

Run: `cd server && docker build -t skillhub-server:dev .`
Expected: 構建成功

- [ ] **Step 4: Commit**

```bash
git add server/Dockerfile server/.dockerignore
git commit -m "feat(ops): add multi-stage Dockerfile for server"
```

---

### Task 4.2: Web 前端 Dockerfile

**檔案:**
- `web/Dockerfile`
- `web/nginx.conf`

**步驟:**

- [ ] **Step 1: 建立 nginx.conf**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://server:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /actuator/ {
        deny all;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

- [ ] **Step 2: 建立 Dockerfile**

```dockerfile
# ---- Build Stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime Stage ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ || exit 1
```

- [ ] **Step 3: 驗證構建**

Run: `cd web && docker build -t skillhub-web:dev .`
Expected: 構建成功

- [ ] **Step 4: Commit**

```bash
git add web/Dockerfile web/nginx.conf
git commit -m "feat(ops): add multi-stage Dockerfile for web frontend with nginx"
```

---

### Task 4.3: docker-compose.yml — 一鍵啟動

**檔案:**
- `docker-compose.yml`

**步驟:**

- [ ] **Step 1: 建立 docker-compose.yml**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: skillhub
      POSTGRES_USER: skillhub
      POSTGRES_PASSWORD: skillhub
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skillhub"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  server:
    build: ./server
    environment:
      SPRING_PROFILES_ACTIVE: docker
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: skillhub
      DB_USER: skillhub
      DB_PASS: skillhub
      SPRING_DATA_REDIS_HOST: redis
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build: ./web
    ports:
      - "80:80"
    depends_on:
      - server

volumes:
  pgdata:
```

- [ ] **Step 2: 驗證啟動**

Run: `docker compose up -d --build`
Expected: 所有服務啟動成功，`docker compose ps` 顯示 4 個 running 容器

- [ ] **Step 3: 驗證健康檢查**

Run: `curl http://localhost:8080/actuator/health`
Expected: `{"status":"UP"}`

Run: `curl http://localhost/`
Expected: 返回前端 HTML 頁面

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(ops): add docker-compose for one-click local deployment"
```

---

### Task 4.4: Makefile — 常用命令封裝

**檔案:**
- `Makefile`

**步驟:**

- [ ] **Step 1: 建立 Makefile**

```makefile
.PHONY: help dev up down test build clean

help: ## 顯示幫助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## 啟動開發環境 (僅 postgres + redis)
	docker compose up -d postgres redis

up: ## 一鍵啟動全部服務
	docker compose up -d --build

down: ## 停止全部服務
	docker compose down

test: ## 執行全部後端測試
	cd server && mvn test

build: ## 構建後端
	cd server && mvn package -DskipTests

clean: ## 清理構建產物
	cd server && mvn clean
	docker compose down -v

logs: ## 檢視服務日誌
	docker compose logs -f server

db-reset: ## 重置資料庫
	docker compose down -v
	docker compose up -d postgres
	@echo "Waiting for postgres..."
	@sleep 3
	cd server && mvn flyway:migrate -pl skillhub-app
```

- [ ] **Step 2: 驗證**

Run: `make help`
Expected: 顯示所有可用命令

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "feat(ops): add Makefile with dev/up/down/test/build commands"
```

---

### Task 4.5: README.md — 專案檔案

**檔案:**
- `README.md`

**步驟:**

- [ ] **Step 1: 建立 README.md**

```markdown
# SkillHub

AI Skill 共享平臺 — 發布、發現、管理 AI 技能包。

## 快速開始

### 前置條件
- Docker & Docker Compose
- JDK 21+ (開發模式)
- Node.js 20+ (前端開發)

### 一鍵啟動

```bash
make up
```

訪問:
- 前端: http://localhost
- API: http://localhost:8080
- Prometheus 指標: http://localhost:8080/actuator/prometheus

### 開發模式

```bash
# 啟動基礎設施
make dev

# 啟動後端
cd server && mvn spring-boot:run

# 啟動前端
cd web && npm run dev
```

### 預設賬號

| 使用者名稱 | 密碼 | 角色 |
|--------|------|------|
| admin  | Admin@2026 | 管理員 |
| demo   | Demo@2026  | 普通使用者 |

## 專案結構

```
skillhub/
├── server/                 # Spring Boot 後端
│   ├── skillhub-app/       # 應用層 (Controller, DTO, Config)
│   ├── skillhub-domain/    # 領域層 (Entity, Service, Repository)
│   ├── skillhub-auth/      # 認證授權模組
│   ├── skillhub-search/    # 搜尋模組
│   └── skillhub-infra/     # 基礎設施層 (JPA 實現)
├── web/                    # React 前端
├── docker-compose.yml      # 一鍵部署
└── Makefile                # 常用命令
```

## 常用命令

```bash
make help      # 檢視所有命令
make test      # 執行測試
make build     # 構建專案
make logs      # 檢視日誌
make db-reset  # 重置資料庫
```

## 技術棧

- **後端:** Spring Boot 3, JDK 21, PostgreSQL, Redis, Flyway
- **前端:** React, TypeScript, Vite
- **運維:** Docker, Prometheus, Actuator

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with quickstart guide"
```

---

### Task 4.6: Prometheus + Grafana 監控棧 (可選)

**檔案:**
- `monitoring/prometheus.yml`
- `monitoring/docker-compose.monitoring.yml`

**步驟:**

- [ ] **Step 1: 建立 Prometheus 配置**

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'skillhub-server'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['server:8080']
```

- [ ] **Step 2: 建立監控 compose 檔案**

```yaml
# monitoring/docker-compose.monitoring.yml
version: "3.9"

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    extra_hosts:
      - "host.docker.internal:host-gateway"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    depends_on:
      - prometheus
```

- [ ] **Step 3: 驗證**

Run: `cd monitoring && docker compose -f docker-compose.monitoring.yml up -d`
Expected: Prometheus 和 Grafana 啟動成功

訪問:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

- [ ] **Step 4: Commit**

```bash
git add monitoring/
git commit -m "feat(ops): add Prometheus + Grafana monitoring stack"
```

---

### Task 4.7: 端到端冒煙測試指令碼

**檔案:**
- `scripts/smoke-test.sh`

**步驟:**

- [ ] **Step 1: 建立冒煙測試指令碼**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
PASS=0
FAIL=0

check() {
    local desc="$1" url="$2" expected="$3"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$status" = "$expected" ]; then
        echo "  PASS: $desc (HTTP $status)"
        ((PASS++))
    else
        echo "  FAIL: $desc (expected $expected, got $status)"
        ((FAIL++))
    fi
}

echo "=== SkillHub Smoke Test ==="
echo "Target: $BASE_URL"
echo ""

# Health
check "Health endpoint" "$BASE_URL/actuator/health" "200"

# Prometheus metrics
check "Prometheus metrics" "$BASE_URL/actuator/prometheus" "200"

# Public API
check "Skill search" "$BASE_URL/api/v1/skills/search?q=test" "200"

# Auth required
check "Auth required (401)" "$BASE_URL/api/v1/me" "401"

# Register
REG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/v1/auth/local/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"smoketest","password":"Smoke@2026"}')
if [ "$REG_STATUS" = "200" ] || [ "$REG_STATUS" = "409" ]; then
    echo "  PASS: Register (HTTP $REG_STATUS)"
    ((PASS++))
else
    echo "  FAIL: Register (got $REG_STATUS)"
    ((FAIL++))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

- [ ] **Step 2: 設定可執行許可權**

Run: `chmod +x scripts/smoke-test.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-test.sh
git commit -m "feat(ops): add end-to-end smoke test script"
```

---

## 完成標誌

所有 Chunk 完成後，執行最終驗證:

- [ ] `make up` — 一鍵啟動全部服務
- [ ] `make test` — 全部後端測試透過
- [ ] `./scripts/smoke-test.sh` — 冒煙測試透過
- [ ] `curl localhost:8080/actuator/prometheus` — 指標正常
- [ ] 前端頁面可正常訪問和操作

```bash
git tag v0.4.0
git push origin feature/project-init --tags
```
