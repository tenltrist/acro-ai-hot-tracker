/* Read-only explanations of recorded decisions; this module never assigns a tier. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.AIHOT_ADMISSION_MODEL = model;
})(typeof window === "undefined" ? globalThis : window, function () {
  const labels = {
    type: "专题类型排除", source: "来源仅观察", relevance: "ACRO 相关性门槛",
    action: "未命中公司且缺少业务动作", age: "基础分未过线 · 有时效降分",
    noise: "基础分未过线 · 有噪音扣分", score: "其他基础分未过线",
    mixed: "多篇报道的原因不同", unknown: "判定依据不足", selected: "已入选",
  };
  const verdicts = { reconsider: "建议复议", knowledge: "适合档案留存", keep: "维持非精选", verify: "需补证或拆分" };
  const shadowLabels = {
    audit_reconsider: "抽查后建议复议",
    audit_verify: "抽查后需补证或拆分",
    near_threshold: "中高相关但基础分接近门槛",
    extraction_gap: "评分已命中动作，但结构化词组未识别",
  };
  const shadowOrder = ["audit_reconsider", "audit_verify", "near_threshold", "extraction_gap"];
  const selected = item => ["daily", "immediate"].includes(item.tier);
  function signature(item) {
    return JSON.stringify([item.id, item.title, item.summary, item.published, item.tier, item.score, item.signal_type,
      item.source_trust, item.acro_relevance, item.selection_reason, item.reasons, item.matched_company_ids, item.intelligence,
      item.url, item.related_urls, item.source_ids, item.source_labels, item.company_id, item.date_provenance]);
  }
  function explain(item, catalog) {
    const reasons = Array.isArray(item.reasons) ? item.reasons : [];
    const stored = item.selection_reason || "";
    const has = term => reasons.some(reason => reason.includes(term));
    let key = "unknown";
    if (selected(item)) key = "selected";
    else if (item.tier === "archive") {
      if (stored.includes("来源处于观察期") || has("试接观察源")) key = "source";
      else if ((catalog?.daily_admission?.forced_archive_signal_types || []).includes(item.signal_type) && has("专题信号")) key = "type";
      else if (stored.includes("相关性较低") || has("低相关信号降为归档")) key = "relevance";
      else if (stored.includes("未命中公司") || has("未命中公司且缺少明确业务动作")) key = "action";
      else if (stored.includes("未达到日报基础分数")) key = has("时效") ? "age" : has("噪音词命中") ? "noise" : "score";
    }
    const notes = reasons.filter(reason => /时效|噪音词命中|专题信号|试接观察源/.test(reason));
    const correction = key === "type" && stored.includes("基础分数") ? "原记录把类型排除统称为分数不足；这里按实际类型限制说明，不修改原分数或入选结果。" : "";
    return { key, label: labels[key], stored, notes, correction };
  }
  function eventReason(event, catalog) {
    if (event.reports.some(selected)) return "selected";
    const keys = [...new Set(event.reports.map(report => explain(report, catalog).key))];
    return keys.length === 1 ? keys[0] : keys.length ? "mixed" : "unknown";
  }
  function counts(events, catalog) {
    const result = new Map();
    for (const event of events) {
      const key = eventReason(event, catalog);
      result.set(key, (result.get(key) || 0) + 1);
    }
    return [...result].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function reviews(event, batch) {
    return event.reports.flatMap(item => {
      const row = batch?.reviews?.find(review => review.id === item.id);
      return row && row.signature === signature(item) ? [row] : [];
    });
  }
  function publicationDay(item) {
    const value = String(item?.published || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }
  function inRange(item, range) {
    const day = publicationDay(item);
    return Boolean(day && range?.start && range?.end && day >= range.start && day <= range.end);
  }
  function shadowReasonForItem(item, { batch, catalog, range } = {}) {
    if (selected(item) || item?.tier !== "archive" || !inRange(item, range)) return "";
    const activeReviews = reviews({ reports: [item] }, batch);
    if (activeReviews.some(review => review.verdict === "reconsider")) return "audit_reconsider";
    if (activeReviews.some(review => review.verdict === "verify")) return "audit_verify";

    const forcedTypes = new Set(catalog?.daily_admission?.forced_archive_signal_types || []);
    const sourceObservation = String(item.selection_reason || "").includes("观察期") ||
      (item.reasons || []).some(reason => String(reason).includes("试接观察源"));
    if (forcedTypes.has(item.signal_type) || sourceObservation) return "";

    const score = Number(item.score) || 0;
    const relevance = item.acro_relevance?.level || "low";
    if (score >= 45 && score < 50 && ["medium", "high"].includes(relevance)) {
      return "near_threshold";
    }
    const scoringAction = (item.reasons || []).some(reason => String(reason).startsWith("业务动作命中"));
    const structuredAction = (item.intelligence?.business_actions || []).length > 0;
    if (score >= 45 && relevance === "low" && (item.matched_company_ids || []).length &&
        ["product", "partnership"].includes(item.category) && scoringAction && !structuredAction) {
      return "extraction_gap";
    }
    return "";
  }
  function shadowEventReason(event, context) {
    if (event.reports.some(selected)) return "";
    const keys = event.reports.map(report => shadowReasonForItem(report, context)).filter(Boolean);
    return shadowOrder.find(key => keys.includes(key)) || "";
  }
  function shadowCounts(events, context) {
    const result = Object.fromEntries(shadowOrder.map(key => [key, 0]));
    for (const event of events) {
      const key = shadowEventReason(event, context);
      if (key) result[key] += 1;
    }
    return shadowOrder.map(key => [key, result[key]]).filter(([, count]) => count);
  }
  return {
    labels, verdicts, shadowLabels, shadowOrder, selected, signature, explain, eventReason, counts, reviews,
    shadowReasonForItem, shadowEventReason, shadowCounts,
  };
});
