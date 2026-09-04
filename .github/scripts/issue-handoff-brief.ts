import { MaintainerHandoffBrief, TriageResult } from "./issue-triage-types.ts";

const AREA_RULES: Array<{ keywords: string[]; area: string }> = [
  {
    keywords: ["clawhub publish", "publish skill", "publish", "namespace"],
    area:
      "CLI 發布命令引數解析與 namespace 感知發布流程 / CLI publish command option parsing and namespace-aware publish flow",
  },
  {
    keywords: ["clawhub install", "install skill", "install"],
    area:
      "技能安裝流程與 registry/lockfile 整合 / Skill installation flow and registry/lockfile integration",
  },
  {
    keywords: ["clawhub update", "update skill", "update"],
    area:
      "已安裝技能更新流程與版本解析 / Installed skill update flow and version resolution",
  },
  {
    keywords: ["clawhub sync", "sync skill", "sync"],
    area:
      "本地技能同步流程與發布 diff 檢測 / Local skill sync flow and publish diff detection",
  },
  {
    keywords: ["inspect", "search", "explore"],
    area:
      "Registry 發現與 CLI 查詢流程 / Registry discovery and CLI query workflow",
  },
  {
    keywords: ["auth", "login", "ldap", "sso", "token"],
    area:
      "認證、會話與身份整合 / Authentication, session, and identity integration",
  },
  {
    keywords: ["openapi", "sdk", "api contract", "contract"],
    area:
      "公開 API 契約、生成 SDK 與相容性表面 / Public API contract, generated SDKs, and compatibility surface",
  },
  {
    keywords: ["docs", "documentation", "manual", "help", "--help"],
    area:
      "檔案、操作指引與 CLI help 輸出 / Documentation, operator guidance, and CLI help output",
  },
  {
    keywords: ["scanner", "security", "audit"],
    area:
      "安全掃描流程與審計/報告行為 / Security scanner pipeline and audit/reporting behavior",
  },
];

export function buildMaintainerHandoffBrief(
  result: TriageResult,
): MaintainerHandoffBrief | undefined {
  if (result.route !== "core") {
    return undefined;
  }

  const summary = buildSummary(result);
  const whyCore = unique([
    result.requiresCoreMaintainer
      ? "阻塞 OpenClaw/ClawHub 核心工作流，因此即便改動範圍看起來可控，也需要 maintainer judgment / Blocks an OpenClaw/ClawHub core workflow, so maintainer judgment is required even if the code change looks bounded."
      : "",
    result.riskLevel === "high"
      ? "觸及高風險區域，未經 maintainer 審查不應直接信任自動修復 / Touches a higher-risk area where automated fixes should not be trusted without maintainer review."
      : "",
    result.effort >= 4
      ? "大機率跨多個模組或公共相容面 / Likely spans multiple modules or a public compatibility surface."
      : "",
    result.confidence <= 3
      ? "問題本身重要，但仍需要 maintainer 先收斂範圍再實施 / The issue is important, but a maintainer still needs to tighten scope before implementation."
      : "",
    ...result.highRiskReasons,
  ]).slice(0, 4);

  const reproduction = buildReproduction(result);
  const suspectedAreas = inferSuspectedAreas(result);
  const risks = buildRisks(result, suspectedAreas);
  const validation = buildValidation(result, suspectedAreas);

  return {
    summary,
    whyCore,
    reproduction,
    suspectedAreas,
    risks,
    validation,
  };
}

function buildSummary(result: TriageResult) {
  const llmSummary = result.llm?.summaryZh ?? result.llm?.summary ??
    result.llm?.summaryEn;

  if (llmSummary && llmSummary.trim().length > 0) {
    return llmSummary.trim();
  }

  const preferred = [
    result.sections["summary"],
    result.sections["problem"],
    result.sections["expected behavior"],
  ].find((value) => value && value.trim().length > 0);

  if (preferred) {
    return compact(preferred);
  }

  return result.issue.title.replace(/^\[[^\]]+\]\s*/, "").trim();
}

function buildReproduction(result: TriageResult) {
  const commandFocusedSteps = extractCommandAndErrorLines(
    result.sections["steps to reproduce"],
  );

  if (commandFocusedSteps.length > 0) {
    return commandFocusedSteps.slice(0, 4);
  }

  const steps = splitIntoBullets(result.sections["steps to reproduce"]);

  if (steps.length > 0) {
    return steps.slice(0, 5);
  }

  const problem = splitIntoBullets(result.sections["problem"]);

  if (problem.length > 0) {
    return problem.slice(0, 4);
  }

  return [
    "按 issue 中描述的操作路徑復現，並確認當前失敗模式 / Recreate the operator flow described in the issue and confirm the current failure mode.",
  ];
}

function inferSuspectedAreas(result: TriageResult) {
  const text = [
    result.issue.title,
    result.sections["summary"] ?? "",
    result.sections["problem"] ?? "",
    result.sections["steps to reproduce"] ?? "",
    result.sections["impact"] ?? "",
    result.sections["api contract impact"] ?? "",
    result.sections["contract or sdk impact"] ?? "",
  ]
    .join("\n")
    .toLowerCase();

  const areas = AREA_RULES.filter((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  ).map((rule) => rule.area);

  if (areas.length > 0) {
    return unique(areas).slice(0, 5);
  }

  return [
    "最接近該失敗路徑的 owner-facing 工作流模組 / The closest owner-facing workflow module for the issue's reported failure path",
    "當前對外承諾該行為的檔案或 help 文字 / Any docs or help text that currently promise the affected behavior",
  ];
}

function buildRisks(result: TriageResult, suspectedAreas: string[]) {
  const risks = unique([
    ...result.highRiskReasons,
    result.llm?.riskFlags.includes("cli-protocol")
      ? "CLI 行為、檔案和操作預期可能發生漂移，需要同步更新命令 help 與相容性說明 / CLI behavior, docs, and operator expectations may drift unless command help and compatibility notes are updated together."
      : "",
    suspectedAreas.some((area) => area.toLowerCase().includes("namespace"))
      ? "namespace 範圍行為如果沒有保留 fallback routing，可能迴歸預設 publish/install 流程 / Namespace-scoped behavior can regress default publish/install flows if fallback routing is not preserved."
      : "",
    result.requiresCoreMaintainer
      ? "該問題影響已定義主流程，迴歸會很快被終端使用者感知 / This issue affects a documented primary workflow, so regressions would be visible to end users quickly."
      : "",
  ]);

  return risks.length > 0 ? risks.slice(0, 4) : [
    "合併前檢查相鄰使用者路徑是否出現迴歸 / Check for regressions in adjacent user-facing workflow paths before merging.",
  ];
}

function buildValidation(result: TriageResult, suspectedAreas: string[]) {
  const validation = unique([
    result.sections["steps to reproduce"]
      ? "按 issue 中的復現步驟逐條回放，確認報告的問題已消失 / Replay the exact reproduction steps from the issue and confirm the reported failure disappears."
      : "修復後端到端驗證主報告流程 / Validate the primary reported workflow end-to-end after the fix.",
    result.sections["expected behavior"]
      ? `確認最終行為符合 issue 期望 / Confirm the final behavior matches the issue's expected outcome: ${
        compact(result.sections["expected behavior"])
      }`
      : "",
    suspectedAreas.some((area) => area.toLowerCase().includes("documentation"))
      ? "更新或核對檔案與 CLI help 輸出，確保其與實現行為一致 / Update or verify documentation and CLI help output so they match the implemented behavior."
      : "",
    suspectedAreas.some((area) => area.toLowerCase().includes("api contract"))
      ? "發布前檢查下游 API/SDK/CLI 的相容性預期 / Check for downstream API/SDK/CLI compatibility expectations before shipping."
      : "",
    suspectedAreas.some((area) => area.toLowerCase().includes("namespace"))
      ? "同時驗證 namespace 範圍行為與預設非 namespace 流程 / Verify both namespace-scoped behavior and the default non-namespace flow."
      : "",
    result.requiresCoreMaintainer
      ? "圍繞受影響的 OpenClaw/ClawHub 使用者路徑執行最小必要回歸測試 / Run the smallest relevant regression test around the affected OpenClaw/ClawHub user journey."
      : "",
  ]);

  return validation.slice(0, 5);
}

function splitIntoBullets(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line.length > 0 &&
      line !== "```" &&
      !line.startsWith("PS ") &&
      !line.startsWith("Usage:") &&
      !line.startsWith("Options:") &&
      !line.startsWith("Arguments:")
    )
    .map((line) => line.replace(/^[*-]\s*/, ""))
    .slice(0, 6);
}

function extractCommandAndErrorLines(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line.length > 0 &&
      (
        line.toLowerCase().includes("clawhub ") ||
        line.toLowerCase().startsWith("error:") ||
        line.toLowerCase().includes("unknown option") ||
        line.toLowerCase().includes("usage:")
      )
    )
    .map((line) => line.replace(/^[>*-]\s*/, ""))
    .slice(0, 4);
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
