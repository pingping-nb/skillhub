## Context

SkillHub 的现有发布单元是一个根目录包含 `SKILL.md` 的 Skill 包。SkillVersion 独立完成包校验、安全扫描、可见性审核、发布和下架。Agent Skills 开放规范同样只认识一个目录中的一个 `SKILL.md`，没有 Suite 协议。

外部方案提供了三类参考：Vercel 把多 Skill 仓库作为安装来源；Claude Plugin/Superpowers 把多个能力封装为特定 Agent 的版本化插件；腾讯 SkillSet 和 VS Code Extension Pack 把集合建成独立资源。SkillHub 选择轻量集合模型：Suite 管理精确的已发布 SkillVersion 引用，成员仍是独立 Skill。

### Ubiquitous language

| Term | Definition |
| --- | --- |
| Skill | 可独立发布、扫描、审核、搜索和安装的 Agent Skill。 |
| Suite | Namespace 所有的、可版本化的 Skill 集合；它不是 Skill，也不是多 Skill ZIP。 |
| SuiteVersion | Suite 在某一时刻不可变的成员快照和元数据。 |
| Member | SuiteVersion 引用的一个精确、已发布 SkillVersion。 |
| Entry Skill | 可选的普通 Member，用于表达工作流入口；不通过名称推断。 |
| Install plan | 服务端解析出的 SuiteVersion、成员精确版本、fingerprint 和下载信息。 |
| Degraded Suite | 已发布 SuiteVersion 的至少一个成员当前不可下载；历史快照仍可查看，但不能完整安装。 |

## Goals / Non-Goals

**Goals:**

- 一次选择和安装一组经过策划的 Skill，并保证失败时不留下半套结果。
- 保留每个 Skill 的独立身份、版本、所有权、扫描、审核、搜索和安装能力。
- 让 SuiteVersion 成为可重现的精确成员快照，而不是随成员 `latest` 漂移的查询。
- 兼容现有 Skill 协议和不同 Agent 的标准 Skill 目录。
- 复用 Namespace 权限、可见性和审核原则，并明确 Suite 与成员生命周期的边界。

**Non-Goals:**

- 不把 `SUITE.yaml` 放进多 Skill ZIP 并由服务端自动创建成员 Skill。
- 不让 Suite 发布、审核、下架、隐藏或删除操作级联改变成员 Skill。
- 不实现嵌套 Suite、版本范围、动态 `latest`、条件成员、成员别名或跨 Registry 引用。
- 不把 MCP、Agent、Hook、LSP 或运行时配置纳入 Suite。
- 不在 v1 提供 Suite promotion、评分、评论或成员自动升级策略。

## Decisions

### 1. Suite 是独立聚合，不是新的 Skill 包格式

新增三个核心关系：

```text
SkillSuite 1 ── * SkillSuiteVersion 1 ── * SkillSuiteVersionMember * ── 0..1 SkillVersion
```

建议持久化字段：

```text
skill_suite
  id, namespace_id, slug, display_name, summary,
  status, latest_version_id, hidden, hidden_at, hidden_by,
  created_by, created_at, updated_by, updated_at

skill_suite_version
  id, suite_id, version, status, visibility, changelog, entry_skill_version_id,
  published_at, yanked_at, yanked_by, yank_reason,
  created_by, created_at

skill_suite_version_member
  suite_version_id, skill_version_id(nullable), position,
  namespace_slug_snapshot, skill_slug_snapshot,
  skill_version_snapshot, fingerprint_snapshot
```

成员表保存外键和不可变快照。SkillVersion 被治理性硬删除时，外键使用 `ON DELETE SET NULL`，Suite 历史仍显示原坐标、版本和 fingerprint，并被标记为不可用。Suite 不阻塞必要的数据删除，也不伪装成仍可安装。

可见性属于 SuiteVersion 的审核快照，而不是覆盖全部历史版本的 Suite 容器字段。列表和默认详情展示 `latestVersionId` 对应的可见性；读取或安装历史版本时使用该版本自己的可见性并叠加实时 Member 权限检查。

**Alternative:** 一份 Suite ZIP 创建 N 个 Skill。拒绝，因为会引入部分发布、重复扫描、N 个审核任务、所有权覆盖和回滚困难。

### 2. Skill 与 Suite 使用类型化身份

完整身份为：

```text
(resourceType, namespaceSlug, slug)
```

因此 `SKILL @global/marketing` 和 `SUITE @global/marketing` 可以同时存在。数据库分别约束 `skill(namespace_id, slug)` 和 `skill_suite(namespace_id, slug)`，不建立跨类型唯一约束。

命令、API、Web URL 和搜索结果必须携带类型：

```text
skillhub install @global/marketing
skillhub suite install @global/marketing

/api/v1/skills/...
/api/v1/suites/...
```

现有无类型 `skillhub install` 永远按 Skill 解析，不能根据搜索结果自动猜测 Suite。

**Alternative:** 在同一 Namespace 中跨类型保留 slug。拒绝，因为限制了正常命名且类型化入口已经能够消除机器歧义。

### 3. SuiteVersion 引用精确的已发布 SkillVersion

作者可以在 `suite.yaml` 中选择成员坐标和版本：

```yaml
apiVersion: skillhub.iflytek.com/v1alpha1
kind: SkillSuite
metadata:
  namespace: global
  slug: superpowers
  version: 1.0.0
  displayName: Superpowers
spec:
  visibility: PUBLIC
  entrySkill: "@global/using-superpowers@1.0.0"
  members:
    - skill: "@global/using-superpowers"
      version: 1.0.0
    - skill: "@global/brainstorming"
      version: 2.1.0
```

该文件是 API/CLI 的创作输入，不是下载到 Agent 的包。服务端在创建 SuiteVersion 时解析并保存精确 `skillVersionId` 和 fingerprint。一个 SuiteVersion 最多包含 100 个不同 Skill；同一 Skill 不允许重复出现。

成员发布新版本不会改变已有 SuiteVersion。采用新版本、添加、删除、重排成员或修改 Entry Skill 都必须创建新的 SuiteVersion。

为了降低创作成本，Web/CLI 在添加 Member 时默认推荐该 Skill 当前可安装的最新版本，但保存时立即解析为精确 `skillVersionId`、version 和 fingerprint，并向作者展示实际固定的版本。作者可以显式选择其他仍处于 PUBLISHED 的历史版本。

不得在已发布 SuiteVersion 中保存 `latest` 或在安装时重新解析最新版本。可以提供“更新成员版本”辅助操作，但该操作必须先展示版本差异，并创建或修改 DRAFT SuiteVersion；它不是后台自动升级。

Member 从当前 SkillHub Registry 的专用候选查询中选择，而不是让前端加载全部 Skill 后自行过滤，也不直接复用只覆盖公开市场的普通搜索。候选查询接收 Suite Namespace、目标可见性和搜索条件，服务端只返回当前用户可读取的 ACTIVE、非 hidden、具有 PUBLISHED 可安装版本的 Skill，并给出版本列表和与目标 Suite 的兼容性结果。默认推荐最新可安装版本，但最终保存精确版本。v1 不支持外部 Registry 成员。

成员版本失效时按阶段处理：

| 发生阶段 | 处理方式 |
| --- | --- |
| 创建或编辑 DRAFT 前 | 无法选择不可安装版本；已经选中的版本标记错误 |
| 提交审核时 | 重新校验并阻止提交，保留 DRAFT |
| 等待审核期间 | 审核通过前重新校验；失败时保持 PENDING_REVIEW 并给出阻塞成员 |
| SuiteVersion 发布后 | 不改写快照和 PUBLISHED 状态，计算为 degraded 并阻止整组安装 |
| 可逆条件恢复后 | hidden、archive 或访问范围恢复且成员精确版本仍可安装时，自动重新计算为 available |
| YANKED 或硬删除 | 不自动换到新版本；创建新的 SuiteVersion 并显式选择有效成员版本 |

**Alternative:** 保存版本范围或 `latest`。推迟，因为相同 SuiteVersion 会随时间解析出不同内容，破坏可重复安装和审计。

### 4. Suite 与 Skill 生命周期相互独立

Skill 继续使用现有生命周期：

```text
上传 → SCANNING/SCAN_FAILED → UPLOADED → PENDING_REVIEW
     → PUBLISHED → YANKED
```

Suite 没有可执行包，不进入扫描状态。SuiteVersion 使用：

```text
DRAFT → PENDING_REVIEW → PUBLISHED → YANKED
                     ↘ REJECTED
```

PRIVATE Suite 按现有 PRIVATE Skill 原则允许授权管理者从 DRAFT 直接发布。PUBLIC 和 NAMESPACE_ONLY Suite 进入一次 Suite 级审核。审核只检查 Suite 元数据、成员组成、可见性和可安装性，不重新审核成员 Skill。

Suite 容器复用 `ACTIVE/ARCHIVED` 和独立的 hidden 治理覆盖。Suite 的发布、拒绝、下架、隐藏、归档或删除都不改变任何 Member。Skill 的新版本、下架、隐藏、归档、可见性变化或硬删除也不改写已经发布的 SuiteVersion。

在 Suite 提交审核、审核通过和安装三个时间点都重新验证成员资格，防止期间状态或权限发生变化。

#### 提交与发布流程

| 阶段 | Skill | Suite | 二者关系 |
| --- | --- | --- | --- |
| 创建内容 | 上传一个包含 `SKILL.md` 的包并创建 SkillVersion | 创建 SuiteVersion，选择已经发布的精确 SkillVersion | Suite 不接收或拆分 Skill 包 |
| 校验 | 校验包结构、文件类型和元数据 | 校验成员存在、已发布、无重复、可见性兼容及 Entry Skill 合法 | Suite 复用成员已有结果，不重新校验成员包 |
| 安全扫描 | 进入 `SCANNING`，成功后进入 `UPLOADED`，失败进入 `SCAN_FAILED` | 无扫描状态 | Suite 没有可执行包，因此不创建扫描任务 |
| 提交审核 | PUBLIC/NAMESPACE_ONLY SkillVersion 进入 `PENDING_REVIEW` | PUBLIC/NAMESPACE_ONLY SuiteVersion 进入 `PENDING_REVIEW` | Suite 只产生一个自己的审核任务，不复制成员审核任务 |
| 审核通过 | SkillVersion 进入 `PUBLISHED` | 再次检查全部成员后，SuiteVersion 进入 `PUBLISHED` | Suite 发布不修改成员；成员必须仍可用于该 Suite |
| 安装 | 安装一个 SkillVersion | 先解析并校验整组成员，再以客户端事务安装全部成员 | Agent 最终只看到标准 Skill 目录 |
| 后续变更 | 新版本、下架、隐藏、归档或删除只作用于该 Skill | 新版本、下架、隐藏、归档或删除只作用于该 Suite | 已发布 SuiteVersion 不被自动改写；成员失效时 Suite 显示 degraded |

这意味着 Suite 是成员 Skill 的“版本化清单”，不是它们的父生命周期。删除 Suite 不删除 Skill；更新 Skill 不更新 Suite；更新 Suite 也不重新发布 Skill。

### 5. 审核任务支持类型化目标

现有 `review_task` 只指向 SkillVersion。为了保留一个审核中心和一致权限规则，将其扩展为类型化审核目标：

```text
subject_type: SKILL_VERSION | SUITE_VERSION
subject_version_id
```

现有 Skill 审核行回填为 `SKILL_VERSION`，旧 Skill 字段在兼容迁移完成前保留。领域服务通过目标处理器完成状态转换，避免 Suite 复制一整套审核控制器和权限判断。

Suite 属于 Namespace，不形成脱离 Namespace 的永久个人所有权。Namespace MEMBER 可以创建 Suite，并在仍属于该 Namespace 时管理自己创建的 DRAFT/REJECTED Suite 和提交新版本；OWNER/ADMIN 可以管理该 Namespace 下全部 Suite。创建者离开 Namespace 后立即失去这类管理权，Suite 及其审核历史仍属于 Namespace，由 OWNER/ADMIN 接管。GLOBAL Namespace 沿用现有平台投稿和审核规则。

审核权限沿用当前 Namespace/平台角色原则：提交者可以查看自己的审核，TEAM OWNER/ADMIN 按现有规则审核，GLOBAL 使用平台审核角色；自审限制不因 Suite 改变。

**Alternative:** 新建 `suite_review_task`。拒绝，因为会产生第二个审核中心、重复权限规则，并增加未来治理能力的分叉。

### 6. Suite 可见范围不能宽于任一成员

发布时必须满足：Suite 的全部潜在安装者都有权读取每个 Member。具体规则为：

- PUBLIC Suite 的所有成员必须为 PUBLIC。
- NAMESPACE_ONLY Suite 的成员必须为 PUBLIC，或属于 Suite 同一 Namespace 且为 NAMESPACE_ONLY；不能包含 PRIVATE Member。
- PRIVATE Suite 的成员可以为 PUBLIC，或属于 Suite 同一 Namespace 的 NAMESPACE_ONLY/PRIVATE；不能引用其他 Namespace 的非 PUBLIC Member。

这些规则检查的是 Suite 的目标受众，而不只是当前操作者。创建者必须具备 Suite 所属 Namespace 的当前投稿权限，并在引用时能够读取每个精确 Member。

安装时仍逐个执行实时授权和可下载性检查。成员后续变为不可见、YANKED、hidden、ARCHIVED 或被硬删除时，SuiteVersion 进入可观察的 degraded 状态；安装整体失败，并指出阻塞成员，不自动替换为其他版本。

权限和可见性变化遵循以下原则：

- Member 从 PUBLIC 收窄为 NAMESPACE_ONLY/PRIVATE，导致已发布 Suite 的目标受众不再全部可访问时，Suite 变为 degraded。
- Member 扩大可见范围且重新满足规则时，Suite 可用性自动恢复，不创建新 SuiteVersion。
- 用户离开 Namespace 后，立即失去 NAMESPACE_ONLY Suite 及其同 Namespace Member 的访问权；Suite 不缓存历史授权。
- Suite 创建者离开 Namespace 后，其 `createdBy` 仅保留为审计事实，不再授予管理权或 PRIVATE Suite 访问权；已发布 Suite 继续存在，OWNER/ADMIN 可以接管。
- Suite 的可见性变化属于新的发布决策，必须通过新 SuiteVersion 和对应审核完成；临时隐藏/恢复仍使用治理覆盖。
- 安装计划在返回任何下载地址前校验 Suite 和全部 Member。无权查看 Member 的用户只获得不泄露私有元数据的通用失败信息；管理员可查看具体阻塞成员。

Suite 操作权限为：

| 操作 | 权限 |
| --- | --- |
| 创建 Suite | 当前 Namespace MEMBER/ADMIN/OWNER；GLOBAL 沿用现有平台投稿规则 |
| 编辑自己的 DRAFT/REJECTED、提交新版本 | 创建者仍是当前 Namespace 成员，或 Namespace ADMIN/OWNER |
| 管理任意 Suite、接管离职用户内容 | Namespace ADMIN/OWNER；平台治理角色按现有规则处理 |
| 查看 PUBLISHED Suite | PUBLIC 为所有人；NAMESPACE_ONLY 为当前 Namespace 成员；PRIVATE 为当前创建者及 Namespace ADMIN/OWNER；SUPER_ADMIN 可治理查看 |
| 查看 DRAFT/REJECTED | 当前创建者、Namespace ADMIN/OWNER 和有治理权限的平台角色 |
| 查看 PENDING_REVIEW | 提交者、Namespace ADMIN/OWNER 和有权审核的角色 |
| 安装 Suite | 先满足 SuiteVersion 自身可见性，再满足全部 Member 的实时访问和可安装条件 |

这里的“当前创建者”必须仍属于 Suite Namespace。离开 Namespace 后不再通过历史 `createdBy` 获得访问权。

### 7. Suite 不在 Agent 目录中伪装成 Skill

安装 Suite 时，成员按普通 Skill 安装到各 Agent 的标准 Skill 根目录。Suite 不创建：

```text
<skills-root>/<suite-slug>/SKILL.md
```

如果 Suite 表达工作流，`entrySkillVersionId` 指向一个普通 Member。Entry Skill 可以与 Suite 同名，也可以不同名；关系只来自显式 ID，不由 slug 推断。

这避免腾讯 SkillSet 当前把编排提示写入普通 Skill 目录造成的覆盖问题，也保证所有 Agent 只需理解标准 Skill。

### 8. Suite 安装是一个客户端事务

`skillhub suite install` 执行：

1. 解析一个精确 SuiteVersion 和全部 Member。
2. 检查 Suite/成员权限、状态、目标目录、现有来源冲突和空间限制。
3. 下载全部成员到目标根目录内的临时目录。
4. 校验每个成员的 fingerprint 和 Skill 元数据。
5. 按稳定顺序获取所有目标锁，备份将被替换的同源目录。
6. 移动全部成员并一次性写入 inventory。
7. 任一步失败时恢复所有备份并保持原 inventory。

服务端只返回安装计划和成员下载能力，不尝试对用户文件系统提供分布式事务。CLI 在现有 staged install、target lock 和 rollback 机制上扩展为多成员计划。

### 9. inventory 记录来源集合而不是单一所有者

inventory schema 增加 `suites`，并让 Skill 安装目标记录来源集合：

```json
{
  "items": [
    {
      "registry": "https://registry.example.com",
      "namespace": "global",
      "slug": "brainstorming",
      "version": "2.1.0",
      "fingerprint": "sha256:...",
      "installedBy": ["direct", "suite:@global/superpowers@1.0.0"],
      "targets": []
    }
  ],
  "suites": [
    {
      "registry": "https://registry.example.com",
      "namespace": "global",
      "slug": "superpowers",
      "version": "1.0.0",
      "members": ["@global/brainstorming@2.1.0"]
    }
  ]
}
```

卸载 Suite 只移除对应来源引用。仍被直接安装或被其他 Suite 引用的 Skill 保留；仅由该 Suite 引入且未被本地修改的成员才自动删除。检测到本地修改时保留目录并报告，不做破坏性清理。

### 10. 查询、升级和展示保持类型明确

新增的类型化资源发现入口返回 `resourceType`，Web 使用类型徽标及独立 `/skills/...`、`/suites/...` 页面。现有 Skill 搜索接口继续只返回 Skill，避免旧 CLI 或第三方客户端把 Suite 响应按 Skill 反序列化。Suite 详情显示版本、精确成员、Entry Skill、可用状态和阻塞原因。

`suite check` 比较 inventory 快照、磁盘 fingerprint 和远端 SuiteVersion；`suite upgrade` 先显示成员增删改计划，再使用与安装相同的原子流程应用新的精确 SuiteVersion。升级不会单独追随 Member 的最新版本。

### 11. 生命周期兼容通过隔离状态与能力协商保证

SkillVersion 和 SuiteVersion 使用独立状态类型。不得把 Suite 专属状态加入现有 `SkillVersionStatus`，也不得因为成员失效或恢复而改写现有 SkillVersion 状态。Suite 的 `degraded` 是根据成员当前可用性计算出的展示/安装状态，不是 `SkillSuiteVersionStatus` 的持久化生命周期值。

Server 和 CLI 按以下组合兼容：

| 组合 | 预期行为 |
| --- | --- |
| 旧 CLI + 新 Server | 原有 Skill 搜索、解析、下载和安装完全不变；旧 CLI 看不到 Suite，也不会误装 Suite |
| 新 CLI + 旧 Server | 普通 Skill 命令正常；Suite 命令通过能力探测得到“不支持 Suite”的明确结果，不猜测接口或回退成 Skill 安装 |
| 新 CLI + 新 Server | 使用 Suite 专用命令、类型化接口和新版 inventory |
| 已安装旧 inventory + 新 CLI | 缺少 Suite 字段时按空集合读取；首次 Suite 写入时原子升级 schema，不改变已有 Skill 记录 |
| 新 Server + 旧数据库数据 | 数据库迁移只新增表和兼容字段；已有 Skill、ReviewTask 和审计记录含义不变 |

能力探测应使用 Server 已有版本/能力入口，或新增稳定的 capability 字段；不得仅依赖 HTTP 404 推断，因为 404 也可能代表代理路径或权限配置错误。Suite API、Suite 状态和 Suite review subject 必须以增量方式加入 OpenAPI，现有 Skill 字段不得改名或改变枚举含义。

审核迁移采用双读/兼容窗口：现有 Skill 审核数据仍能通过旧的 Skill 关联字段读取，新写入的 Suite 审核使用类型化 subject；确认所有运行版本均支持新结构后，才允许在后续迁移中收紧旧字段。应用回滚期间保留新增表和字段，禁止回滚数据库结构。

### 12. 拒绝重提和安装统计采用可追溯语义

SuiteVersion 被拒绝后允许由管理者退回 DRAFT，保留原审核记录并修改未发布版本后再次提交。PUBLISHED/YANKED SuiteVersion 永远不可编辑；这些版本的任何变化都创建新 SuiteVersion。每次重新提交创建新的审核轮次，不覆盖旧决定。

一次 Suite 安装计划使用服务端生成的唯一 `operationId` 串联一条 Suite 安装计划审计和多条 Member 下载审计。服务端成功签发完整安装计划后，Suite 安装请求数增加一次；计划内每个 Member SkillVersion 按现有下载统计口径增加一次，并标记 `source=SUITE`。同一 `operationId` 的安全重试不得重复计数。

服务端无法可靠知道 CLI 最终是否完成本地文件提交，因此该指标表示“安装计划/下载已签发”，不宣称是本地安装成功数。CLI 后续校验或提交失败不反向扣减服务端计数；v1 不增加客户端完成回调或遥测上报。

## Risks / Trade-offs

- **审核表从 Skill 专用扩展为类型化目标** → 使用增量迁移、回填和兼容读取，保留现有 Skill 审核回归测试。
- **成员状态改变会使历史 Suite 无法安装** → 保留不可变快照、展示 degraded 原因，禁止静默换版。
- **多成员、多 Agent 目标导致锁和回滚复杂** → 限制 100 个成员，预检后按规范化路径排序加锁，inventory 最后原子写入。
- **共享成员卸载可能误删直接安装内容** → inventory 保存多来源引用，本地修改和来源不明时 fail closed。
- **Skill/Suite 同 slug 可能让自然语言含糊** → CLI、API、URL、搜索结果和安装提示始终携带资源类型；旧 `install` 固定解析 Skill。
- **在现有 Skill 搜索中直接混入 Suite 会破坏旧客户端** → 保留 Skill-only 旧接口，另增类型化资源发现入口。
- **审核目标和状态枚举扩展可能破坏滚动升级** → Suite 使用独立状态；审核表按兼容窗口增量迁移，并在混合版本验证后再收紧旧字段。
- **不支持一份 ZIP 创建全部成员，首次迁移多 Skill 仓库仍需发布成员** → v1 优先保证领域和生命周期正确；以后可增加调用现有发布 API 的批量 CLI 编排，但不改变 Suite 模型。

## Migration Plan

1. 新增 Suite 三张表、索引和类型化审核字段；回填现有审核任务为 `SKILL_VERSION`。
2. 先发布兼容旧 API 的 Server；新表为空时现有行为不变。
3. 发布 Web 的 Suite 管理和类型化审核展示，重新生成 OpenAPI 类型。
4. 发布支持 Suite 和新版 inventory 的 CLI；读取旧 inventory 时将缺少的 `suites`、`installedBy` 视为空。
5. 用本地 exact-SHA 镜像验证 Skill 正常流、Suite 生命周期、成员失效和整组回滚。

回滚应用版本时保留新增表和字段，旧版本忽略它们；在确认没有 Suite 数据前不得删除迁移结构。

## Open Questions

以下内容明确推迟，不阻塞 v1：

- 是否提供“批量发布成员后创建 Suite”的 CLI 编排。
- 是否为 Suite 增加收藏、评分、评论和独立订阅。
- 是否允许跨 Registry Suite 或对外导出通用集合清单。
- 是否在后续支持 Suite promotion 和组织级强制安装策略。
