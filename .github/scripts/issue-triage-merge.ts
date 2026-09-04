import { TriageResult, TriageSnapshot } from "./issue-triage-types.ts";
import { buildMaintainerHandoffBrief } from "./issue-handoff-brief.ts";

export function mergeRuleAndLlm(ruleResult: TriageResult): TriageResult {
  const llm = ruleResult.llm;

  if (!llm || llm.failed || llm.mode !== "assist") {
    return {
      ...ruleResult,
      handoffBrief: ruleResult.route === "core"
        ? buildMaintainerHandoffBrief(ruleResult)
        : undefined,
      mode: llm && !llm.failed && llm.mode === "shadow"
        ? "llm-shadow"
        : "rules-only",
      inputHash: llm?.inputHash ?? ruleResult.inputHash,
    };
  }

  const impact = nudgeScore(ruleResult.impact, llm.impact);
  const urgency = nudgeScore(ruleResult.urgency, llm.urgency);
  const effort = nudgeScore(ruleResult.effort, llm.effort);
  const confidence = nudgeScore(ruleResult.confidence, llm.confidence);
  const missingFields = unique([
    ...ruleResult.missingFields,
    ...llm.missingInfo,
  ]);
  const highRiskReasons = unique([
    ...ruleResult.highRiskReasons,
    ...llm.riskFlags.map((flag) =>
      `LLM 標記了高風險區域：${flag} / LLM flagged high-risk area: ${flag}.`
    ),
  ]);
  const requiresCoreMaintainer = ruleResult.requiresCoreMaintainer;
  const riskLevel = highRiskReasons.length > 0 ? "high" : "low";
  const priority = clamp(
    roundToOneDecimal(
      impact * 0.45 +
        urgency * 0.35 +
        ruleResult.ageBoost +
        ruleResult.engagementBoost,
    ),
    1,
    5,
  );
  const route = determineRoute(
    priority,
    effort,
    confidence,
    riskLevel,
    missingFields,
    requiresCoreMaintainer,
  );
  const nextAction = describeNextAction(route, missingFields);
  const reasons = unique([
    ...ruleResult.reasons,
    ...llm.rationale,
    llm.summary
      ? `LLM 摘要：${llm.summaryZh || llm.summary} / LLM summary: ${
        llm.summaryEn || llm.summary
      }`
      : "",
  ]).slice(0, 6);

  const mergedSnapshot: TriageSnapshot = {
    route,
    riskLevel,
    requiresCoreMaintainer,
    openDays: ruleResult.openDays,
    impact,
    urgency,
    effort,
    confidence,
    priority,
    ageBoost: ruleResult.ageBoost,
    priorityFloor: ruleResult.priorityFloor,
    engagementBoost: ruleResult.engagementBoost,
    missingFields,
    reasons,
    highRiskReasons,
    nextAction,
  };

  return {
    ...ruleResult,
    ...mergedSnapshot,
    mode: "llm-assist",
    inputHash: llm.inputHash,
    handoffBrief: route === "core"
      ? buildMaintainerHandoffBrief({
        ...ruleResult,
        ...mergedSnapshot,
        mode: "llm-assist",
        inputHash: llm.inputHash,
      })
      : undefined,
  };
}

export function determineRoute(
  priority: number,
  effort: number,
  confidence: number,
  riskLevel: "low" | "high",
  missingFields: string[],
  requiresCoreMaintainer = false,
) {
  if (requiresCoreMaintainer) {
    return "core";
  }

  if (missingFields.length > 0 || confidence <= 2) {
    return "needs-info";
  }

  if (priority < 3.6) {
    return "deferred";
  }

  if (riskLevel === "high" || effort >= 4 || confidence <= 3) {
    return "core";
  }

  return "agent-ready";
}

export function describeNextAction(
  route: TriageResult["route"],
  missingFields: string[],
) {
  if (route === "needs-info") {
    return `等待補充更多資訊；作者更新 issue 或評論 \`/retriage\` 後重新分流 / Wait for more detail, then rerun triage after the author edits the issue or comments \`/retriage\`. Missing: ${
      missingFields.join(", ")
    }.`;
  }

  if (route === "deferred") {
    return "將 issue 保留在 deferred 佇列，並由 6 小時一次的 rescore 持續抬升；最晚在第 10 天強制進入 active lane。若第 14 天仍未閉環，應按 SLA 視為 P0 升級目標，並在下一次 triage 中重點處理 / Keep the issue in the deferred queue and let the 6-hour rescore keep lifting it; it is forced into an active lane by day 10. If it is still open on day 14, treat it as a P0 escalation target under the SLA and prioritize it in the next triage pass.";
  }

  if (route === "core") {
    return "交給 core maintainer，並結合本地程式設計Agent協助完成復現、收斂範圍與驗證閉環 / Hand the issue to a core maintainer and use a local programming agent for reproduction, scoping, and validation.";
  }

  return "在 self-hosted issue-agent runner 啟用後，將其標記為低風險 agent 可執行候選 / Mark as a candidate for low-risk agent execution once the self-hosted issue-agent runner is enabled.";
}

function nudgeScore(ruleScore: number, llmScore: number) {
  if (llmScore === ruleScore) {
    return ruleScore;
  }

  return clamp(ruleScore + Math.sign(llmScore - ruleScore), 1, 5);
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
