const admissionModel = window.AIHOT_ADMISSION_MODEL;
const admissionBatch = window.AIHOT_ADMISSION_REVIEWS;
const boardAdmissionReason = event => admissionModel.eventReason(event, window.AIHOT_RULE_CATALOG);
const boardAdmissionReviews = event => admissionModel.reviews(event, admissionBatch);
const boardShadowContext = () => ({
  batch: admissionBatch,
  catalog: window.AIHOT_RULE_CATALOG,
  range: boardSelectionRange(),
});
const boardShadowReason = event => admissionModel.shadowEventReason(event, boardShadowContext());
let admissionShadowCache = { payload: null, archive: null, value: null };

function admissionShadowSummary() {
  const archive = state.eventArchive || window.AIHOT_EVENT_ARCHIVE || {};
  if (admissionShadowCache.payload === state.payload && admissionShadowCache.archive === archive) {
    return admissionShadowCache.value;
  }
  const events = periodView.payload === state.payload && periodView.archive === archive
    ? periodView.events
    : periodModel.buildEvents([...(archive.items || []), ...(state.payload?.items || [])], {
      companies: state.payload?.companies || [], classify: getBusinessEventType, regions: boardEventRegions,
    });
  const selected = events.filter(event => boardRecordKind(event) === "selected");
  const other = events.filter(event => boardRecordKind(event) === "other");
  const counts = admissionModel.shadowCounts(other, boardShadowContext());
  const review = counts.reduce((sum, [, count]) => sum + count, 0);
  const value = { total: events.length, selected: selected.length, other: other.length, review, retained: other.length - review, counts };
  admissionShadowCache = { payload: state.payload, archive, value };
  return value;
}

function boardAdmissionRows(items) {
  const rows = admissionModel.counts(items, window.AIHOT_RULE_CATALOG);
  const sampled = items.filter(event => boardAdmissionReviews(event).length);
  const shadow = items.filter(event => boardShadowReason(event));
  return `<section class="admission-overview"><header class="board-section-head"><h3>为什么没有入选</h3><div class="admission-overview-actions"><button type="button" class="text-button" data-board-shadow>查看 V1.1 影子候选 · ${shadow.length} 条 →</button><button type="button" class="text-button" data-board-audit>查看漏选抽查 · ${sampled.length} 条 →</button></div></header><p class="board-muted">按已存评分日志归类，不重新评分。每个事件只计一个主原因；时效、噪音等附加影响在详情保留。</p><div class="admission-reason-grid">${rows.map(([key, count]) => `<button type="button" data-board-admission-reason="${key}"><span>${escapeHtml(admissionModel.labels[key])}</span><strong>${count}</strong><span aria-hidden="true">→</span></button>`).join("") || '<p class="board-empty">当前筛选没有其他留存资料。</p>'}</div></section>`;
}

function boardAuditReviewMarkup(review) {
  return `<div class="admission-review" data-audit-review="${escapeAttr(review.id)}"><p class="admission-opinion"><strong>${admissionModel.verdicts[review.verdict]}</strong><span>抽查意见 · 未应用</span></p><dl><div><dt>材料所述</dt><dd>${escapeHtml(review.fact)}</dd></div><div><dt>判断与边界</dt><dd>${escapeHtml(review.note)}</dd></div><div><dt>核对范围</dt><dd>${escapeHtml(review.material)}</dd></div></dl>${review.evidence.length ? `<ul class="admission-evidence">${review.evidence.map(source => `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a><span>${escapeHtml(source.supports)}</span></li>`).join("")}</ul>` : '<p class="board-muted">本轮未取得补充原文；只作现有材料级判断，原始入口见事件详情。</p>'}</div>`;
}

function boardAdmissionDetail(event) {
  const reports = event.reports.map(item => {
    const explanation = admissionModel.explain(item, window.AIHOT_RULE_CATALOG);
    const thresholds = window.AIHOT_RULE_CATALOG.daily_admission.base_thresholds;
    return `<div class="admission-record-explanation" data-admission-report="${escapeAttr(item.id)}">${event.reports.length > 1 ? `<h4>${escapeHtml(item.title)}</h4>` : ""}<p><strong>${explanation.label}</strong> · 信息分 ${Number.isFinite(item.score) ? item.score : "未记录"} · ACRO相关分 ${Number.isFinite(item.acro_relevance?.score) ? item.acro_relevance.score : "未记录"}</p>${explanation.correction ? `<p class="board-notice">${explanation.correction}</p>` : ""}<p class="board-muted">历史判定使用当次采集的日期与材料。当前目录基础线：普通 ${thresholds.daily} 分；自有/生态/媒体 ${thresholds.owned_ecosystem_media} 分；命中业务动作 ${thresholds.business_action} 分。过基础线仍需经过相关性、类型和来源限制。</p><details><summary>原始判定与评分日志</summary><p>${escapeHtml(explanation.stored || "未记录原始判定")}</p><ul>${(item.reasons || []).map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></details></div>`;
  }).join("");
  const reviews = boardAdmissionReviews(event);
  const outdated = !reviews.length && event.reports.some(item => admissionBatch.reviews.some(row => row.id === item.id));
  const shadowReason = boardShadowReason(event);
  const shadow = shadowReason ? `<p class="admission-shadow-status"><strong>V1.1 影子判断：待复核</strong><span>${escapeHtml(admissionModel.shadowLabels[shadowReason])}</span><small>这是试算结果，未修改现行入选状态。</small></p>` : "";
  return `<section class="board-detail-band admission-detail"><h3>入选依据与抽查</h3>${shadow}${reports}${reviews.map(boardAuditReviewMarkup).join("")}${outdated ? '<p class="board-notice">该记录在抽查后发生变化，旧意见已停用，需重新核对。</p>' : ""}</section>`;
}

function boardShadowPanel(scoped, route) {
  const candidates = scoped.filter(event => boardShadowReason(event));
  const counts = admissionModel.shadowCounts(scoped, boardShadowContext());
  return `<section class="admission-shadow-intro"><header><div><span>V1.1 影子规则</span><h3>待复核候选</h3></div><strong>${candidates.length}<small>事件记录</small></strong></header><p>只试算，不改现行分数、层级或242条入选结果。这里用于找出词表不一致、接近门槛和已抽查待补证的信息，不等于这些新闻应当自动入选。</p><div class="admission-shadow-filters"><button type="button" data-board-shadow-reason="all" aria-pressed="${!route.shadowReason || route.shadowReason === "all"}">全部候选 <b>${candidates.length}</b></button>${counts.map(([key, count]) => `<button type="button" data-board-shadow-reason="${key}" aria-pressed="${route.shadowReason === key}">${escapeHtml(admissionModel.shadowLabels[key])} <b>${count}</b></button>`).join("")}</div></section>`;
}

function boardAuditPanel(scoped, route) {
  const sample = scoped.filter(event => boardAdmissionReviews(event).length);
  const selected = boardItems("history", "selected").length;
  return `<section class="admission-audit-intro"><p>目的性抽查，不代表全库漏选率。意见未经业务确认，实际入选结果未改变。</p><p class="admission-comparison"><span>当前筛选实际入选 <strong>${selected}</strong></span><span>抽查候选意见 <strong>${sample.filter(event => boardAdmissionReviews(event).some(row => row.verdict === "reconsider")).length}</strong></span><span>已应用变更 <strong>0</strong></span></p><div class="admission-verdicts" role="group" aria-label="抽查意见筛选"><button type="button" data-board-audit-verdict="all" aria-pressed="${!route.auditVerdict || route.auditVerdict === "all"}">全部样本 <b>${sample.length}</b></button>${Object.entries(admissionModel.verdicts).map(([key, label]) => `<button type="button" data-board-audit-verdict="${key}" aria-pressed="${route.auditVerdict === key}">${label} <b>${sample.filter(event => boardAdmissionReviews(event).some(row => row.verdict === key)).length}</b></button>`).join("")}</div><p class="board-muted">当前筛选命中 ${sample.length} / ${admissionBatch.reviews.length} 个样本 · 不是30篇全文精读。</p><details><summary>抽样方法与核对边界</summary><p>${escapeHtml(admissionBatch.method)}</p><p>${escapeHtml(admissionBatch.scope)}</p><p>核对日期 ${admissionBatch.checked_at} · 样本快照 ${admissionBatch.snapshot_generated_at.slice(0, 10)}。同一合并事件可能有多条抽查意见，意见分类数可能重叠；主原因数量按事件去重。</p></details></section>`;
}

function boardAuditList(items) {
  if (!items.length) return '<p class="board-empty">当前条件下没有抽查样本，不代表没有留存信息。</p>';
  return `<ol class="admission-audit-list">${items.map(event => `<li data-audit-event="${escapeAttr(event.id)}"><header><span class="board-muted">${escapeHtml(event.published || "发布日期未确认")} · ${escapeHtml(event.companyIds.map(boardCompanyName).join(" / ") || "行业信息，未命中公司")}</span><h3><button type="button" class="board-event-link" data-board-event="${escapeAttr(event.id)}">${escapeHtml(boardEventTitle(event))}</button></h3><p>现行结果：${boardRecordStatus(event)} · ${admissionModel.labels[boardAdmissionReason(event)]}</p></header>${boardAdmissionReviews(event).map(boardAuditReviewMarkup).join("")}<button type="button" class="text-button" data-board-event="${escapeAttr(event.id)}">原始记录与评分依据 →</button></li>`).join("")}</ol>`;
}

function openAdmissionShadow(reason = "", resetFilters = false) {
  if (periodView.level !== "records") fusionSwitchBrowse("records");
  periodView.recordKind = "other";
  if (resetFilters) {
    Object.assign(periodView, { regions: [], category: "all", topic: "all", company: "all", role: "all", query: "", relevance: "all", signalType: "all" });
    const query = document.querySelector("#boardQuery");
    if (query) query.value = "";
  }
  const parent = { type: "list", value: "all", history: true };
  return openBoardRoute({ type: "list", value: "admission-shadow", shadowReason: reason && reason !== "all" ? reason : "", parent });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-board-audit], [data-board-admission-reason], [data-board-audit-verdict], [data-board-shadow], [data-board-shadow-reason], [data-admission-shadow-open]");
  if (!button) return;
  if (button.hasAttribute("data-admission-shadow-open")) return openAdmissionShadow(button.dataset.admissionShadowOpen || "", true);
  if (button.hasAttribute("data-board-shadow")) return openAdmissionShadow();
  if (button.hasAttribute("data-board-shadow-reason")) {
    return openBoardRoute({ ...periodView.route, shadowReason: button.dataset.boardShadowReason === "all" ? "" : button.dataset.boardShadowReason });
  }
  if (button.hasAttribute("data-board-audit-verdict")) {
    return openBoardRoute({ ...periodView.route, auditVerdict: button.dataset.boardAuditVerdict });
  }
  const parent = periodView.route;
  return openBoardRoute(button.hasAttribute("data-board-audit")
    ? { type: "list", value: "admission-audit", parent }
    : { type: "list", value: "admission-reason", admissionReason: button.dataset.boardAdmissionReason, parent });
});

window.AIHOT_ADMISSION_UI = { summary: admissionShadowSummary, openShadow: openAdmissionShadow };
