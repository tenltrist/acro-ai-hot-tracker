const periodModel = window.AIHOT_OVERVIEW_MODEL;
const periodView = {
  level: "main", mainDays: 30,
  mode: "week", anchor: "", regions: [], category: "all", topic: "all", company: "all", signalType: "all", relevance: "all",
  role: "all", query: "", recordKind: "all", companyTab: "competitor", route: null, limit: 40,
  events: [], payload: null, archive: null, scroll: 0,
};
const boardRegions = window.AIHOT_REGION_MODEL.definitions.map(row => [row.id, row.label]);
const boardRegionLabel = value => boardRegions.find(([id]) => id === value)?.[1] || value;
const boardTopicLabel = value => value === "unidentified" ? "主题未识别" : value;
const boardCompany = id => (state.payload?.companies || []).find(company => company.id === id);
const boardCompanyName = id => boardCompany(id)?.display_name || id;
const boardToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const boardRootPage = () => periodView.level === "main" ? "overview" : periodView.level === "records" ? "period-detail" : "period-overview";
const boardRootLabel = () => periodView.level === "records" ? "历史记录" : periodView.level === "main" ? "总览" : periodView.mode === "month" ? "月看板" : "周看板";
const boardRange = () => periodView.level === "main"
  ? { start: periodModel.offset(boardToday(), 1 - periodView.mainDays), end: boardToday(), days: periodView.mainDays }
  : periodModel.period(periodView.mode, periodView.anchor || boardToday());
const boardRangeText = () => periodView.level === "records" ? "全部已保留历史" : `${boardRange().start} 至 ${boardRange().end}`;
const boardScope = () => ({ ...periodView, today: boardToday() });

function boardEventRegions(item) {
  return fusionRegions(item);
}

function refreshPeriodEvents() {
  const archive = state.eventArchive || window.AIHOT_EVENT_ARCHIVE || {};
  if (periodView.payload === state.payload && periodView.archive === archive) return;
  periodView.payload = state.payload;
  periodView.archive = archive;
  periodView.events = periodModel.buildEvents([...(archive.items || []), ...(state.payload?.items || [])], {
    companies: state.payload?.companies || [], classify: getBusinessEventType, regions: boardEventRegions,
  });
}

const boardRecordLabels = { all: "全部记录", selected: "入选信息", other: "其他留存资料" };
const boardSelectionWindowLabels = { current: "总览近90天内", outside: "总览范围外", unknown: "发布日期未确认" };

function boardRecordKind(event) {
  return event.reports.some(report => ["daily", "immediate"].includes(report.tier)) ? "selected" : "other";
}

function boardRecordStatus(event) {
  if (boardRecordKind(event) === "selected") return "入选信息";
  return event.reports.length && event.reports.every(report => report.tier === "archive") ? "其他留存资料（未入选）" : "其他留存资料（入选状态未确认）";
}

function boardSelectionRange() {
  const end = periodModel.date(state.payload.generated_at);
  return { start: periodModel.offset(end, -89), end };
}

function boardSelectionWindow(event) {
  if (!event.published) return "unknown";
  const range = boardSelectionRange();
  return event.published >= range.start && event.published <= range.end ? "current" : "outside";
}

function boardSelectionBreakdown(items) {
  const range = boardSelectionRange();
  return `<section class="board-selection-breakdown" aria-label="入选信息的发布日期分布"><p>总览近90天：${range.start} 至 ${range.end} · 入选不等于在当前时间范围内</p><div>${Object.entries(boardSelectionWindowLabels).map(([key, label]) => `<button type="button" data-board-selection-window="${key}"><span>${label}</span><strong>${items.filter(event => boardSelectionWindow(event) === key).length}</strong><span aria-hidden="true">→</span></button>`).join("")}</div></section>`;
}

function boardItems(mode = "period", recordKind = periodView.recordKind) {
  const items = periodModel.select(periodView.events, boardScope(), boardRange(), periodView.level === "records" && mode === "period" ? "history" : mode);
  return periodView.level === "records" && ["selected", "other"].includes(recordKind) ? items.filter(event => boardRecordKind(event) === recordKind) : items;
}

function boardEventTitle(event) {
  const item = event.item;
  // Do not replace a concrete untranslated headline with a generic company/category label.
  return periodView.language === "en" ? item.title : item.title_zh || item.title || "标题缺失";
}

function boardSummary(event) {
  return fusionSummary(event.item, periodView.language);
}

function boardSourceHost(event) {
  try { return new URL(event.evidence[0]?.url).hostname.replace(/^www\./, ""); } catch { return "来源待核对"; }
}

function boardSectionTitle(title, count, action = "") {
  return `<header class="board-section-head"><h2>${title}${Number.isFinite(count) ? `<small>${count}</small>` : ""}</h2>${action}</header>`;
}

function boardEventRows(items, limit = 6) {
  if (!items.length) return '<p class="board-empty">当前条件下暂无已保留记录，不代表市场没有发生事件。</p>';
  return `<ol class="board-event-rows">${items.slice(0, limit).map(event => `<li data-board-row="${escapeAttr(event.id)}">
    <time>${escapeHtml(event.published || "日期待核对")}<small>${event.published ? "发布" : "未计入周期"}</small></time>
    <div><button class="board-event-link" type="button" data-board-event="${escapeAttr(event.id)}">${escapeHtml(boardEventTitle(event))}</button>
    <div class="board-event-meta"><span>${escapeHtml(event.companyIds.map(id => compactCompanyName(boardCompany(id))).join(" / ") || "行业公开信息")}</span><span>${escapeHtml(labelBusinessEvent(event.category, true))}</span><span>${escapeHtml(event.topics.slice(0, 3).map(boardTopicLabel).join(" / "))}</span></div>
    <small class="board-source-line">${escapeHtml(boardSourceHost(event))} · ${event.evidence.length} 个原文链接</small>${periodView.route?.value === "admission-shadow" ? `<small class="admission-row-reason shadow">V1.1 待复核：${escapeHtml(admissionModel.shadowLabels[boardShadowReason(event)])}</small>` : periodView.level === "records" && boardRecordKind(event) === "other" ? `<small class="admission-row-reason">未入选：${escapeHtml(admissionModel.labels[boardAdmissionReason(event)])}</small>` : ""}</div>
    <button class="board-arrow" type="button" data-board-event="${escapeAttr(event.id)}" aria-label="查看事件详情" title="查看事件详情">→</button>
  </li>`).join("")}</ol>`;
}

function boardBars(items, field, labeler, limit = 9) {
  const allBuckets = periodModel.buckets(items, field);
  const unknown = field === "topics" ? allBuckets.find(([value]) => value === "unidentified")?.[1] || 0 : 0;
  const buckets = allBuckets.filter(([value]) => field !== "topics" || value !== "unidentified");
  const unknownLink = unknown ? `<button type="button" class="board-unknown-topic" data-board-field="topics" data-board-value="unidentified">另有 ${unknown} 条尚未识别产品 / 技术主题 →</button>` : "";
  if (!buckets.length) return '<p class="board-empty">暂无明确产品 / 技术主题</p>' + unknownLink;
  const max = buckets[0][1];
  const rows = buckets.map(([value, count], index) => `<button type="button" class="board-bar-row" data-board-field="${field}" data-board-value="${escapeAttr(value)}" aria-label="${escapeAttr(labeler(value))}：${count} 条事件记录">
    <span>${escapeHtml(labeler(value))}</span><i><b style="width:${count / max * 100}%"></b></i><strong>${count}</strong>
  </button>`);
  return rows.slice(0, limit).join("") + (rows.length > limit ? `<details class="board-more"><summary>其余 ${rows.length - limit} 个主题</summary>${rows.slice(limit).join("")}</details>` : "") + unknownLink;
}

function boardRegionBars(items) {
  const model = window.AIHOT_REGION_MODEL;
  const rows = model.families.map(family => ({ ...family, count: items.filter(event => event.regions.some(id => family.members.includes(id))).length })).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map(row => row.count));
  const row = (id, label, count, field = "regions") => `<button type="button" class="board-bar-row" data-board-field="${field}" data-board-value="${id}" ${count ? "" : "disabled"}><span>${escapeHtml(label)}</span><i><b style="width:${count / max * 100}%"></b></i><strong>${count}</strong></button>`;
  const detail = id => row(id, boardRegionLabel(id), items.filter(event => event.regions.includes(id)).length);
  return rows.filter(family => family.count).map(family => row(family.id, family.label, family.count, "regionGroup") + (family.id === "apac" ? `<details class="board-region-breakdown"><summary>日本等地区明细</summary>${family.members.map(detail).join("")}</details>` : "")).join("") + `<details class="board-region-breakdown"><summary>范围与未明确地区</summary>${[...model.scopeIds, "nonregional", "unknown"].map(detail).join("")}</details>`;
}

function renderBoardTrend(items) {
  const range = boardRange();
  const daily = new Map(periodModel.buckets(items, "published"));
  const max = Math.max(1, ...daily.values());
  const snapshot = periodModel.date(state.payload.generated_at);
  return `<div class="board-daily-chart" style="--day-count:${range.days}" role="group" aria-label="按新闻发布日期的事件记录数量">${Array.from({ length: range.days }, (_, index) => {
    const day = periodModel.offset(range.start, index);
    const count = daily.get(day) || 0;
    const future = day > boardToday();
    const pending = !future && day > snapshot;
    return `<button type="button" class="board-day ${future || pending ? "board-day-pending" : ""}" data-board-field="published" data-board-value="${day}" title="${day}：${future ? "未来日期" : pending ? "等待采集更新" : `${count} 条已保留事件记录`}" ${future || pending ? "disabled" : ""}>
      <strong>${future || pending ? "·" : count}</strong><i><b style="height:${count / max * 100}%"></b></i><span>${range.days === 7 || index % 5 === 0 || index === range.days - 1 ? day.slice(5) : day.slice(8)}</span>
    </button>`;
  }).join("")}</div>`;
}

function boardCompanyRows(items, role) {
  const companies = (state.payload.companies || []).filter(company => company.business_role === role);
  const rows = companies.map(company => ({ company, events: items.filter(event => event.companyIds.includes(company.id)) }))
    .filter(row => row.events.length)
    .sort((a, b) => b.events.length - a.events.length || getCompetitiveRank(a.company) - getCompetitiveRank(b.company) || a.company.id.localeCompare(b.company.id));
  if (!rows.length) return '<p class="board-empty">本期没有该类公司的已保留记录；公司池与监测配置未删除。</p>';
  return `<div class="board-company-table"><div class="board-company-table-head"><span>公司</span><span>本期记录</span><span>主要变化</span><span>最新发布</span></div>${rows.map(({ company, events }) => `<button type="button" class="board-company-row" data-board-company="${escapeAttr(company.id)}">
    <span class="company-name-with-logo">${companyLogoMarkup(company)}${companyNameMarkup(company)}</span>
    <b>${events.length}</b><span>${escapeHtml(periodModel.buckets(events, "category").slice(0, 2).map(([value, count]) => `${labelBusinessEvent(value, true)} ${count}`).join(" · "))}</span><time>${events[0].published || "待核对"}</time>
  </button>`).join("")}</div>`;
}

function boardFilterSummary(includeRange = true) {
  const values = includeRange ? [boardRangeText()] : [];
  if (periodView.regions.length) values.push(periodView.regions.map(boardRegionLabel).join("、"));
  if (periodView.category !== "all") values.push(labelBusinessEvent(periodView.category));
  if (periodView.topic !== "all") values.push(boardTopicLabel(periodView.topic));
  if (periodView.role !== "all") values.push(labelRole(periodView.role));
  if (periodView.company !== "all") values.push(boardCompanyName(periodView.company));
  if (periodView.query) values.push(`搜索：${periodView.query}`);
  if (periodView.signalType !== "all") values.push([...els.signalTypeFilter.options].find(option => option.value === periodView.signalType)?.textContent || periodView.signalType);
  if (periodView.relevance !== "all") values.push([...els.relevanceFilter.options].find(option => option.value === periodView.relevance)?.textContent || periodView.relevance);
  return values.join(" · ");
}

function syncBoardControls() {
  const root = document.querySelector("#periodControls");
  root.dataset.level = periodView.level;
  document.querySelector("#boardRecordModes").hidden = periodView.level !== "records";
  const retained = periodView.level === "records" ? boardItems("history", "all") : [];
  root.querySelectorAll("[data-board-records]").forEach(button => {
    const selected = button.dataset.boardRecords === periodView.recordKind;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.querySelector("b").textContent = button.dataset.boardRecords === "all" ? retained.length : retained.filter(event => boardRecordKind(event) === button.dataset.boardRecords).length;
  });
  document.querySelector("#boardRootLabel").textContent = boardRootLabel();
  document.querySelector("#boardRegionMode").value = fusion.regionMode;
  document.querySelectorAll("[data-main-days]").forEach(button => {
    const active = Number(button.dataset.mainDays) === periodView.mainDays;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  root.querySelectorAll("[data-board-mode]").forEach(button => {
    const active = button.dataset.boardMode === periodView.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#boardWeekDate").value = periodView.anchor;
  document.querySelector("#boardMonthDate").value = periodView.anchor.slice(0, 7);
  document.querySelector("#boardWeekPicker").hidden = periodView.mode !== "week";
  document.querySelector("#boardMonthPicker").hidden = periodView.mode !== "month";
  document.querySelector("#boardCurrentPeriod").textContent = periodView.mode === "week" ? "本周" : "本月";
  document.querySelector("#boardRangeLabel").textContent = boardRangeText();
  for (const direction of [-1, 1]) {
    const button = document.querySelector(`[data-board-shift="${direction}"]`);
    const label = `${direction < 0 ? "上一" : "下一"}${periodView.mode === "week" ? "周" : "月"}`;
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  document.querySelector("#boardFilterScope").textContent = boardFilterSummary(false);
  document.querySelector("#boardFilterScope").hidden = !boardFilterSummary(false);
  document.querySelector("#boardRegionsSummary").textContent = fusionRegionSelectionLabel(periodView.regions);
  root.querySelectorAll("[data-board-region]").forEach(input => { input.checked = periodView.regions.includes(input.value); });
  fusionSyncRegionFamily("board", periodView.regions);
  for (const [id, key] of [["boardCategory", "category"], ["boardTopic", "topic"], ["boardCompany", "company"], ["boardRole", "role"], ["boardSignalType", "signalType"], ["boardRelevance", "relevance"]]) document.getElementById(id).value = periodView[key];
  if (document.activeElement?.id !== "boardQuery") document.querySelector("#boardQuery").value = periodView.query;
  document.querySelectorAll("[data-board-language]").forEach(button => {
    const active = button.dataset.boardLanguage === periodView.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function hydrateBoardFilters() {
  document.querySelector("#boardSignalType").innerHTML = els.signalTypeFilter.innerHTML;
  document.querySelector("#boardRelevance").innerHTML = els.relevanceFilter.innerHTML;
  const companySelect = document.querySelector("#boardCompany");
  const companies = sortCompaniesForDisplay(state.payload.companies || []);
  companySelect.innerHTML = '<option value="all">全部公司</option>' + companies.map(company => `<option value="${escapeAttr(company.id)}">${escapeHtml(companySelectLabel(company))}</option>`).join("");
  const categories = Object.keys(businessEventDefinitions);
  document.querySelector("#boardCategory").innerHTML = '<option value="all">全部商业事件</option>' + categories.map(value => `<option value="${value}">${escapeHtml(labelBusinessEvent(value))}</option>`).join("");
  const topics = [...new Set(periodView.events.flatMap(event => event.topics))].sort();
  document.querySelector("#boardTopic").innerHTML = '<option value="all">全部产品 / 技术主题</option>' + topics.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(boardTopicLabel(value))}</option>`).join("");
}

function renderPeriodOverview() {
  if (!state.payload) return;
  if (!["period", "records"].includes(periodView.level)) return;
  if (!periodView.anchor) periodView.anchor = boardToday();
  if (!periodView.language) periodView.language = state.translationLanguage;
  const prior = periodView.payload;
  refreshPeriodEvents();
  if (prior !== state.payload) hydrateBoardFilters();
  const items = boardItems();
  if (periodView.level === "records") {
    periodView.route ||= { type: "list", value: "all", history: true };
    syncBoardControls();
    renderBoardDetail(items);
    return;
  }
  const unknown = boardItems("unknown");
  const companies = [...new Set(items.flatMap(event => event.companyIds))];
  const products = items.filter(event => ["product_platform", "target_therapy"].includes(event.category));
  const partnerships = items.filter(event => event.category === "partnership_deal");
  const range = boardRange();
  const earliest = periodView.events.map(event => event.published).filter(Boolean).sort()[0] || "";
  const retainedSince = periodModel.date(periodView.archive?.retention_started_at) || periodModel.date(state.payload.generated_at);
  const asOf = periodModel.date(state.payload.generated_at);
  const coverage = range.end < earliest ? "此时段尚无可查询历史，不可据此判断市场活动为零。"
    : range.start < retainedSince ? "此时段含回溯样本，历史覆盖不完整；未找到记录不等于没有事件。"
      : `记录保留始于 ${retainedSince}，当前周期仍可能存在来源漏报。`;
  document.querySelector("#boardCoverage").innerHTML = `<span>${state.archiveSyncFailed ? "历史文件同步失败，目前仅显示可用快照；" : ""}${escapeHtml(coverage)}</span><button type="button" data-board-unknown>日期待核对 ${unknown.length} 条</button>`;
  document.querySelector("#boardSnapshot").textContent = `${state.payloadSyncFailed ? "同步失败，仍显示旧快照 · " : ""}数据截至 ${formatDateTime(state.payload.generated_at)} · 日本时间日历`;
  if (periodView.level === "main") {
    renderMainOverview(items);
    syncBoardControls();
    renderBoardDetail(items);
    return;
  }
  const periodStatus = range.start > boardToday() ? "未来周期，尚未覆盖" : range.end > asOf ? "本期尚未结束 / 数据截至最近采集" : "历史周期";
  document.querySelector("#boardPeriodStatus").textContent = `${periodView.mode === "week" ? "自然周" : "自然月"} · 全部留存事件 · ${periodStatus}`;
  document.querySelector("#boardPeriodHeading").textContent = periodView.mode === "week" ? "这一周的市场动态" : "这个月的市场动态";
  const metrics = [["all", "事件记录", items.length, "同链接 / 同日同标题保守合并"], ["companies", "涉及公司", companies.length, "本期命中监测公司"], ["products", "产品与技术动态", products.length, "产品平台与靶点技术"], ["partnerships", "合作与交易动态", partnerships.length, "合作、授权及交易报道"]];
  document.querySelector("#boardMetrics").innerHTML = metrics.map(([key, label, count, note]) => `<button type="button" class="board-metric" data-board-list="${key}" data-board-count="${key}"><span>${label}</span><strong>${count}</strong><small>${note}</small><i aria-hidden="true">→</i></button>`).join("");
  const top = periodModel.buckets(items, "category")[0];
  document.querySelector("#boardPeriodBrief").textContent = items.length ? `本期已保留 ${items.length} 条事件记录，涉及 ${companies.length} 家监测公司。${top ? `主要变化为${labelBusinessEvent(top[0])}（${top[1]} 条）。` : ""}` : "当前范围没有已保留的事件记录。请结合历史覆盖提示判断。";
  document.querySelector("#boardTrend").innerHTML = renderBoardTrend(items);
  document.querySelector("#boardCategoryBars").innerHTML = boardBars(items, "category", labelBusinessEvent);
  document.querySelector("#boardTopicBars").innerHTML = boardBars(items, "topics", boardTopicLabel, 6);
  document.querySelector("#boardRegionBars").innerHTML = boardRegionBars(items);
  document.querySelector("#boardTimeline").innerHTML = boardEventRows(items, 6);
  document.querySelector("#boardProductRows").innerHTML = boardEventRows(products, 4);
  document.querySelector("#boardPartnershipRows").innerHTML = boardEventRows(partnerships, 4);
  document.querySelector("#boardLatestRows").innerHTML = boardEventRows(items.filter(event => event.item.signal_type === "news" || !event.item.signal_type), 3);
  document.querySelectorAll("[data-board-tab]").forEach(button => {
    const role = button.dataset.boardTab;
    const n = new Set(items.filter(event => event.roles.includes(role)).flatMap(event => event.companyIds.filter(id => boardCompany(id)?.business_role === role))).size;
    button.querySelector("b").textContent = n;
    button.classList.toggle("active", role === periodView.companyTab);
    button.setAttribute("aria-selected", String(role === periodView.companyTab));
  });
  document.querySelector("#boardCompanyRows").innerHTML = boardCompanyRows(items, periodView.companyTab);
  syncBoardControls();
  renderBoardDetail(items);
}

function boardRouteLabel(route) {
  if (!route) return boardRootLabel();
  if (route.admissionReason) return admissionModel.labels[route.admissionReason] || "未入选原因";
  if (route.value === "admission-shadow") return route.shadowReason ? `V1.1 待复核 · ${admissionModel.shadowLabels[route.shadowReason] || "未知原因"}` : "V1.1 影子候选";
  if (route.value === "admission-audit") return route.auditVerdict && route.auditVerdict !== "all" ? `漏选抽查 · ${admissionModel.verdicts[route.auditVerdict] || "未知意见"}` : "漏选抽查与对照";
  if (route.selectionWindow) return boardSelectionWindowLabels[route.selectionWindow] || "入选信息的日期分布";
  if (periodView.level === "records" && route.type === "list" && route.value === "all") return boardRecordLabels[periodView.recordKind];
  if (route.start && route.end) return `${route.start} 至 ${route.end}`;
  if (route.company && route.field === "category") return `${compactCompanyName(boardCompany(route.company))} · ${labelBusinessEvent(route.value)}`;
  if (route.type === "company") return compactCompanyName(boardCompany(route.value) || { id: route.value });
  if (route.type === "event") return "事件与证据";
  if (route.field === "category") return labelBusinessEvent(route.value);
  if (route.field === "topics") return boardTopicLabel(route.value);
  if (route.field === "published") return `${route.value} 发布记录`;
  if (route.field === "regions") return boardRegionLabel(route.value);
  if (route.field === "regionGroup") return window.AIHOT_REGION_MODEL.families.find(row => row.id === route.value)?.label || route.value;
  if (route.field === "roles") return labelRole(route.value);
  return { all: "全部事件", critical: "重大信号", apac: "亚太地区动态", companies: "涉及公司", products: "产品与技术动态", partnerships: "合作与交易动态", unknown: "日期待核对" }[route.value] || "事件明细";
}

function boardRouteItems(route, scoped) {
  let items = route.value === "unknown" ? boardItems("unknown") : scoped;
  if (route.admissionReason) items = items.filter(event => boardAdmissionReason(event) === route.admissionReason);
  if (route.value === "admission-shadow") items = items.filter(event => {
    const reason = boardShadowReason(event);
    return reason && (!route.shadowReason || reason === route.shadowReason);
  });
  if (route.value === "admission-audit") items = items.filter(event => boardAdmissionReviews(event).some(review => !route.auditVerdict || route.auditVerdict === "all" || review.verdict === route.auditVerdict));
  if (route.selectionWindow) items = items.filter(event => boardSelectionWindow(event) === route.selectionWindow);
  if (route.company) items = items.filter(event => event.companyIds.includes(route.company));
  if (route.start && route.end) items = items.filter(event => event.published >= route.start && event.published <= route.end);
  if (route.type === "company") {
    items = route.history ? boardItems("history") : scoped;
    return items.filter(event => event.companyIds.includes(route.value));
  }
  if (route.field === "regionGroup") {
    const family = window.AIHOT_REGION_MODEL.families.find(row => row.id === route.value);
    return items.filter(event => event.regions.some(id => family?.members.includes(id)));
  }
  if (route.field) return items.filter(event => Array.isArray(event[route.field]) ? event[route.field].includes(route.value) : event[route.field] === route.value);
  if (route.value === "products") return items.filter(event => ["product_platform", "target_therapy"].includes(event.category));
  if (route.value === "partnerships") return items.filter(event => event.category === "partnership_deal");
  if (route.value === "critical") return items.filter(boardIsCritical);
  if (route.value === "apac") return items.filter(event => event.regions.some(region => overviewApacRegions.has(region)));
  return items;
}

function renderBoardDetail(scoped) {
  const route = periodView.route;
  if (!route) return;
  const host = document.querySelector("#periodDetail");
  const parent = route.parent;
  const recordsRoot = periodView.level === "records" && route.type === "list" && route.value === "all" && !route.field;
  const parentIsRoot = parent?.type === "list" && parent.value === "all" && periodView.level === "records";
  const breadcrumbs = `<nav class="board-breadcrumbs" aria-label="当前位置"><button type="button" data-main-home>看板</button><span aria-hidden="true">/</span><button type="button" data-board-home>${boardRootLabel()}</button>${periodView.level === "records" ? `<span aria-hidden="true">/</span><button type="button" data-board-records="${periodView.recordKind}">${boardRecordLabels[periodView.recordKind]}</button>` : ""}${parent && !parentIsRoot ? `<span aria-hidden="true">/</span><button type="button" data-board-parent>${escapeHtml(boardRouteLabel(parent))}</button>` : ""}<span aria-hidden="true">/</span><strong aria-current="page">${escapeHtml(boardRouteLabel(route))}</strong></nav>`;
  let body = "";
  if (route.type === "event") {
    const event = periodView.events.find(event => event.id === route.value || event.reports.some(item => item.id === route.value));
    if (!event) body = '<p class="board-empty">此事件不在当前已保留记录中，可能来自其他版本。请返回总览查询。</p>';
    else {
      const summary = boardSummary(event);
      const raw = event.item;
      const sourceDate = periodModel.date(raw.event_start_at || raw.published);
      const dateTypes = raw.evidence?.source_types || [];
      const sourceDateMeaning = dateTypes.includes("sitemap_urls") ? "网页发现日期，不是产品发布日期" : dateTypes.includes("clinical_trials") ? "临床试验登记更新日期，不是新闻发布时间" : "尚不能区分新闻发布时间和活动时间";
      body = `<article class="board-evidence-page" data-board-detail-event="${escapeAttr(event.id)}">
        <p class="board-kicker">${escapeHtml(labelBusinessEvent(event.category))} · 规则分类</p><h2>${escapeHtml(boardEventTitle(event))}</h2>
        ${raw.title_zh && periodView.language !== "en" ? `<details class="board-original"><summary>原文标题</summary><p>${escapeHtml(raw.title)}</p></details>` : ""}
        <div class="board-company-links">${event.companyIds.map(id => `<button type="button" data-board-company="${escapeAttr(id)}" class="company-name-with-logo">${companyLogoMarkup(boardCompany(id))}${companyNameMarkup(boardCompany(id))}</button>`).join("") || "尚未命中监测公司"}</div>
        <dl class="board-facts">${periodView.level === "records" ? `<div><dt>保存状态</dt><dd>已留存</dd></div><div><dt>筛选结果</dt><dd>${boardRecordStatus(event)}</dd></div>` : ""}<div><dt>新闻发布时间</dt><dd>${event.published || "未确认"}</dd></div><div><dt>事件发生时间</dt><dd>${event.eventDate || "未确认，不以发布日期替代"}</dd></div><div><dt>产品 / 技术主题</dt><dd>${escapeHtml(event.topics.map(boardTopicLabel).join("、"))}</dd></div><div><dt>地区线索</dt><dd>${escapeHtml(event.regions.map(boardRegionLabel).join("、"))}<small>${fusion.regionMode === "reviewed" ? "标题 / 摘录的明确线索与已核对原文补证" : "仅标题 / 来源摘录的明确线索"}；不以总部或媒体所在地推定，不等于已在当地发生。</small></dd></div></dl>
        ${event.reports.length === 1 ? fusionRegionMarkup(raw) : `<details class="board-original"><summary>各报道的地区依据 · ${event.reports.length} 条</summary>${event.reports.map(report => `<p>${escapeHtml(report.title)}</p>${fusionRegionMarkup(report)}`).join("")}</details>`}
        ${!event.published && sourceDate ? `<p class="board-notice">来源日期字段为 ${sourceDate}：${sourceDateMeaning}；不计入周期统计。</p>` : ""}
        ${periodView.level === "records" ? boardAdmissionDetail(event) : ""}
        <section class="board-detail-band"><h3>${summary.label}</h3><p class="board-full-summary">${escapeHtml(summary.text)}</p>${renderSummaryReview(raw, periodView.language)}</section>
        ${event.category === "partnership_deal" ? `<section class="board-detail-band"><h3>合作内容与参与方</h3><p>${escapeHtml(raw.title)}</p><p class="board-muted">标题 / 摘录是当前关系证据；命中多家公司不等于已确认它们互为合作方。未核实的合作对象、条款与阶段不补猜。</p></section>` : ""}
        <section class="board-detail-band"><h3>原始证据 <small>${event.evidence.length} 个链接</small></h3><ol class="board-evidence-links">${event.evidence.map(source => `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(new URL(source.url).hostname)} <span aria-hidden="true">↗</span></a><small>${escapeHtml(source.labels.join(" / "))}</small><a class="board-source-url" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a></li>`).join("") || "<li>暂无有效原文链接</li>"}</ol></section>
        <details class="board-original"><summary>合并与记录口径</summary><p>${event.reports.length} 条记录按相同链接或同日同标题保守合并，保留 ${event.evidence.length} 个原文链接。来源入口数不等于独立报道数；跨语言与相近标题尚未自动合并。</p></details>
      </article>`;
    }
  } else {
    const items = boardRouteItems(route, scoped);
    const company = route.type === "company" ? boardCompany(route.value) : null;
    const historyScope = periodView.level === "records" ? `${boardRecordLabels[periodView.recordKind]} · ${boardFilterSummary()}。全部已保存；按事件去重，日期未知置后，历史覆盖不完整。` : "全部已保留历史，沿用当前地区、商业事件与主题筛选；未确认日期置后。历史覆盖不完整。";
    const selectionScope = route.selectionWindow ? `${boardSelectionWindowLabels[route.selectionWindow]} · 总览范围 ${boardSelectionRange().start} 至 ${boardSelectionRange().end}。${route.selectionWindow === "unknown" ? "不以抓取时间替代发布日期，不计入周期。" : "按可信新闻发布日期划分。"} ${boardFilterSummary(false)}` : "";
    body = `<header class="board-detail-heading"><div>${company ? `<div class="company-name-with-logo">${companyLogoMarkup(company, "profile")}<h2>${companyNameMarkup(company)}</h2></div><p>${company.business_role === "customer" ? "日本市场监测账户；不代表已确认客户或已有交易。" : escapeHtml(company.role_label || labelRole(company.business_role))}</p>` : `<h2>${escapeHtml(boardRouteLabel(route))}</h2>`}<p>${escapeHtml(selectionScope || (route.history || periodView.level === "records" ? historyScope : route.value === "unknown" ? "日期待核对，沿用当前非时间筛选；这些记录不计入任何周期统计。" : boardFilterSummary()))}</p></div><strong data-board-result-count="${items.length}">${items.length}<small>事件记录</small></strong></header>
      ${recordsRoot && periodView.recordKind === "selected" ? boardSelectionBreakdown(items) : ""}
      ${recordsRoot && periodView.recordKind === "other" ? boardAdmissionRows(items) : ""}
      ${route.value === "admission-shadow" ? boardShadowPanel(scoped, route) : ""}
      ${route.value === "admission-audit" ? boardAuditPanel(scoped, route) : ""}
      ${company ? `<div class="board-company-history"><div class="segmented-control"><button type="button" data-board-company-scope="period" class="${!route.history ? "active" : ""}">本期记录</button><button type="button" data-board-company-scope="history" class="${route.history ? "active" : ""}">已保留历史</button></div><button type="button" class="text-button" data-board-source-profile="${escapeAttr(company.id)}">数据源档案 →</button></div>` : ""}
      ${route.value === "companies" ? `<div class="board-company-directory">${[...new Set(items.flatMap(event => event.companyIds))].map(id => `<button type="button" data-board-company="${escapeAttr(id)}" class="company-name-with-logo">${companyLogoMarkup(boardCompany(id))}${companyNameMarkup(boardCompany(id))}<span>${items.filter(event => event.companyIds.includes(id)).length} 条</span></button>`).join("")}</div>` : ""}
      ${route.value === "admission-audit" ? boardAuditList(items) : boardEventRows(items, periodView.limit)}${route.value !== "admission-audit" && items.length > periodView.limit ? `<button type="button" class="text-button board-load-more" data-board-more>再显示 ${Math.min(40, items.length - periodView.limit)} 条（已显示 ${periodView.limit} / ${items.length}）</button>` : ""}`;
  }
  host.innerHTML = `${recordsRoot ? "" : `<div class="board-detail-nav"><button type="button" class="methodology-back-button" data-board-back title="返回${escapeAttr(parent ? boardRouteLabel(parent) : boardRootLabel())}"><span aria-hidden="true">←</span> 返回</button>${breadcrumbs}<div class="segmented-control board-detail-language" aria-label="摘要语言"><button type="button" data-board-language="zh" class="${periodView.language === "zh" ? "active" : ""}">中</button><button type="button" data-board-language="en" class="${periodView.language === "en" ? "active" : ""}">EN</button></div></div>`}${body}`;
}

function writeBoardUrl(mode = "push") {
  const query = new URLSearchParams({ mode: periodView.mode, date: periodView.anchor, lang: periodView.language || state.translationLanguage });
  if (periodView.level === "main") query.set("days", periodView.mainDays);
  if (periodView.level === "records" && ["selected", "other"].includes(periodView.recordKind)) query.set("records", periodView.recordKind);
  for (const key of ["category", "topic", "company", "role", "query", "signalType", "relevance"]) if (periodView[key] && periodView[key] !== "all") query.set(key, periodView[key]);
  if (periodView.regions.length) query.set("regions", periodView.regions.join(","));
  if (periodView.route) query.set("view", JSON.stringify(periodView.route));
  const hash = `#${periodView.level === "records" ? "records" : periodView.level === "main" ? "home" : "board"}?${query}`;
  if (location.hash === hash) return;
  history[mode === "replace" ? "replaceState" : "pushState"]({ page: "overview", scroll: periodView.scroll }, "", location.pathname + location.search + hash);
}

function restoreBoardUrl() {
  if (!location.hash.startsWith("#board?") && !location.hash.startsWith("#home?") && !location.hash.startsWith("#records?")) return false;
  periodView.level = location.hash.startsWith("#records?") ? "records" : location.hash.startsWith("#home?") ? "main" : "period";
  const params = new URLSearchParams(location.hash.split("?")[1]);
  if (periodView.level === "main") periodView.mainDays = params.get("days") === "90" ? 90 : 30;
  periodView.mode = params.get("mode") === "month" ? "month" : "week";
  periodView.anchor = periodModel.date(params.get("date")) || boardToday();
  periodView.language = ["en", "zh"].includes(params.get("lang")) ? params.get("lang") : state.translationLanguage;
  for (const key of ["category", "topic", "company", "role", "signalType", "relevance"]) periodView[key] = params.get(key) || "all";
  periodView.query = params.get("query") || "";
  periodView.recordKind = params.get("records") === "archive" ? "other" : ["selected", "other"].includes(params.get("records")) ? params.get("records") : "all";
  periodView.regions = (params.get("regions") || "").split(",").filter(id => boardRegions.some(([value]) => value === id));
  try { periodView.route = JSON.parse(params.get("view") || "null"); } catch { periodView.route = null; }
  if (periodView.route && !["list", "event", "company"].includes(periodView.route.type)) periodView.route = null;
  periodView.limit = 40;
  state.page = periodView.route ? "period-detail" : boardRootPage();
  return true;
}

function openBoardRoute(route, mode = "push") {
  const returning = periodView.route?.parent === route;
  if (periodView.route) periodView.route.scroll = window.scrollY;
  if (!periodView.route) periodView.scroll = window.scrollY;
  periodView.route = route;
  periodView.limit = 40;
  state.page = route ? "period-detail" : boardRootPage();
  writeBoardUrl(mode);
  renderPeriodOverview();
  renderPage();
  window.scrollTo({ top: returning ? route?.scroll || periodView.scroll : route ? 0 : periodView.scroll, behavior: "instant" });
  if (route) document.querySelector("#periodDetail h2")?.focus({ preventScroll: true });
}

function openMainOverview() {
  fusionHome();
}

function openPeriodBoard(mode, { preserveAnchor = false } = {}) {
  fusion.homeScroll = window.scrollY;
  periodView.level = "period";
  periodView.mode = mode === "month" ? "month" : "week";
  if (!preserveAnchor || !periodView.anchor) periodView.anchor = boardToday();
  periodView.scroll = 0;
  openBoardRoute(null);
}

function boardIsCritical(event) {
  return event.reports.some(item => overviewMetricDefinitions.critical.matches(item));
}

function mainTrendBins(items) {
  const range = boardRange();
  const step = range.days > 30 ? 7 : 3;
  return Array.from({ length: Math.ceil(range.days / step) }, (_, index) => {
    const start = periodModel.offset(range.start, index * step);
    const end = [periodModel.offset(start, step - 1), range.end].sort()[0];
    return { start, end, count: items.filter(event => event.published >= start && event.published <= end).length };
  });
}

function renderMainCompetitorMatrix(items) {
  const companies = sortCompaniesForDisplay((state.payload.companies || []).filter(company => company.business_role === "competitor"));
  const competitorItems = items.filter(event => event.roles.includes("competitor"));
  const categories = periodModel.buckets(competitorItems, "category").slice(0, 5).map(([category]) => category);
  if (!categories.length) return '<p class="board-empty">当前范围没有竞品事件；公司池与来源配置均保留。</p>';
  return `<div class="main-matrix-scroll"><table class="main-matrix"><thead><tr><th scope="col">竞品（相关性高 → 低）</th>${categories.map(category => `<th scope="col">${escapeHtml(labelBusinessEvent(category, true))}</th>`).join("")}<th scope="col">全部</th></tr></thead><tbody>${companies.map(company => {
    const events = items.filter(event => event.companyIds.includes(company.id));
    return `<tr><th scope="row"><button type="button" data-board-company="${escapeAttr(company.id)}" class="company-name-with-logo">${companyLogoMarkup(company)}${companyNameMarkup(company)}</button></th>${categories.map(category => {
      const count = events.filter(event => event.category === category).length;
      return `<td><button type="button" data-board-field="category" data-board-value="${category}" data-matrix-company="${escapeAttr(company.id)}" ${count ? "" : "disabled"} style="--intensity:${Math.min(0.3, count * 0.015)}" aria-label="${escapeAttr(compactCompanyName(company))}，${escapeAttr(labelBusinessEvent(category))}，${count} 条">${count || "—"}</button></td>`;
    }).join("")}<td><button type="button" data-board-company="${escapeAttr(company.id)}" aria-label="${escapeAttr(compactCompanyName(company))}全部 ${events.length} 条">${events.length}</button></td></tr>`;
  }).join("")}</tbody></table></div><p class="board-muted">列出当前数量最多的 ${categories.length} 类商业事件；“全部”包含其余类别。零记录不代表公司没有动态。</p>`;
}

function renderMainOverview(items) {
  const companyIds = new Set(items.flatMap(event => event.companyIds));
  const competitorItems = items.filter(event => event.roles.includes("competitor"));
  const customerItems = items.filter(event => event.roles.includes("customer"));
  const partnerItems = items.filter(event => event.category === "partnership_deal");
  const apacItems = items.filter(event => event.regions.some(region => overviewApacRegions.has(region)));
  const critical = items.filter(boardIsCritical);
  const metrics = [
    ["critical", "重大信号", critical.length, "沿用入选且 ACRO 高相关规则", ""],
    ["competitor", "竞品动态", competitorItems.length, "命中竞品池的事件记录", "accent"],
    ["customer", "账户动态信号", customerItems.length, "监测账户，不代表已确认客户", "warn"],
    ["apac", "亚太地区动态", apacItems.length, "东亚、东南亚、南亚、大洋洲及明确亚太", "regional"],
  ];
  document.querySelector("#mainMetrics").innerHTML = metrics.map(([key, title, count, note, style]) => `<button type="button" class="metric executive main-metric ${style}" ${["competitor", "customer"].includes(key) ? `data-board-field="roles" data-board-value="${key}"` : `data-board-list="${key}"`} data-main-count="${key}"><span>${title}</span><strong>${count}</strong><small>${note}</small><i aria-hidden="true">→</i></button>`).join("");
  document.querySelector("#mainBrief").textContent = `${boardRangeText()} · ${items.length} 条事件记录 · ${companyIds.size} 家公司`;
  document.querySelector("#mainSnapshot").textContent = document.querySelector("#boardSnapshot").textContent;
  document.querySelector("#mainCoverage").innerHTML = document.querySelector("#boardCoverage").innerHTML;
  document.querySelector("#mainRecordCount").textContent = `${items.length} 条 →`;
  document.querySelector("#mainCompanyCount").textContent = `${companyIds.size} 家 →`;
  const health = getSourceHealthRows().filter(row => row.enabled !== false);
  document.querySelector("#mainHealth").textContent = `${health.length} 个本轮入口 · ${health.filter(row => row.status === "error").length} 个异常`;
  document.querySelector("#mainLatest").innerHTML = boardEventRows(items.filter(event => !event.item.signal_type || event.item.signal_type === "news"), 3);
  document.querySelector("#mainAccountMatrix").innerHTML = boardCompanyRows(items, "customer");
  document.querySelector("#mainCompetitorCount").textContent = `${competitorItems.length} 条 →`;
  document.querySelector("#mainPartnerCount").textContent = `${partnerItems.length} 条 →`;
  document.querySelector("#mainCompetitorRows").innerHTML = boardEventRows(competitorItems, 3);
  document.querySelector("#mainPartnerRows").innerHTML = boardEventRows(partnerItems, 3);
  document.querySelector("#mainCompetitorMatrix").innerHTML = renderMainCompetitorMatrix(items);
  document.querySelector("#mainRegions").innerHTML = boardBars(items, "regions", boardRegionLabel);
  document.querySelector("#mainCategories").innerHTML = boardBars(items, "category", labelBusinessEvent);
  const bins = mainTrendBins(items);
  const max = Math.max(1, ...bins.map(bin => bin.count));
  document.querySelector("#mainTrendScope").textContent = `按发布日期 · 每 ${periodView.mainDays === 90 ? 7 : 3} 天分组`;
  document.querySelector("#mainTrend").innerHTML = `<div class="board-daily-chart main-trend-chart" style="--day-count:${bins.length}">${bins.map(bin => `<button type="button" class="board-day" data-main-bin="${bin.start}" data-main-end="${bin.end}" title="${bin.start} 至 ${bin.end}：${bin.count} 条"><strong>${bin.count}</strong><i><b style="height:${bin.count / max * 100}%"></b></i><span>${bin.start.slice(5)}</span></button>`).join("")}</div>`;
}

function initPeriodOverview() {
  periodView.anchor = boardToday();
  restoreBoardUrl();
  document.querySelector("#boardFilterPanel").open = true;
  document.querySelector("#boardRegionsList").innerHTML = fusionRegionOptions("board");
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-main-home], [data-main-days], [data-period-entry], [data-main-bin], [data-board-list], [data-board-field], [data-board-event], [data-board-company], [data-board-back], [data-board-home], [data-board-parent], [data-board-unknown], [data-board-more], [data-board-company-scope], [data-board-source-profile], [data-board-tab], [data-board-mode], [data-board-shift], [data-board-current], [data-board-clear], [data-board-regions-all], [data-board-language], [data-board-refresh], [data-board-records], [data-board-selection-window]");
    if (!button) return;
    if (button.hasAttribute("data-main-home")) return openMainOverview();
    if (button.hasAttribute("data-period-entry")) return fusionSwitchBrowse(button.dataset.periodEntry);
    if (button.hasAttribute("data-board-records")) {
      periodView.recordKind = ["selected", "other"].includes(button.dataset.boardRecords) ? button.dataset.boardRecords : "all";
      return openBoardRoute({ type: "list", value: "all", history: true });
    }
    if (button.hasAttribute("data-board-selection-window")) return openBoardRoute({ type: "list", value: "selected-window", selectionWindow: button.dataset.boardSelectionWindow, parent: periodView.route });
    if (button.hasAttribute("data-main-days")) { periodView.mainDays = Number(button.dataset.mainDays); return openMainOverview(); }
    if (button.hasAttribute("data-main-bin")) return openBoardRoute({ type: "list", value: "all", start: button.dataset.mainBin, end: button.dataset.mainEnd });
    if (button.hasAttribute("data-board-list")) return openBoardRoute({ type: "list", value: button.dataset.boardList });
    if (button.hasAttribute("data-board-field")) return openBoardRoute({ type: "list", field: button.dataset.boardField, value: button.dataset.boardValue, ...(button.dataset.matrixCompany ? { company: button.dataset.matrixCompany } : {}) });
    if (button.hasAttribute("data-board-event")) return openBoardRoute({ type: "event", value: button.dataset.boardEvent, parent: periodView.route?.type !== "event" ? periodView.route : periodView.route.parent });
    if (button.hasAttribute("data-board-company")) return openBoardRoute({ type: "company", value: button.dataset.boardCompany, parent: periodView.route });
    if (button.hasAttribute("data-board-back") || button.hasAttribute("data-board-parent")) {
      if (periodView.level === "records" && !periodView.route?.parent) return fusionSwitchBrowse("overview");
      return openBoardRoute(periodView.route?.parent || null);
    }
    if (button.hasAttribute("data-board-home")) return openBoardRoute(null);
    if (button.hasAttribute("data-board-unknown")) return openBoardRoute({ type: "list", value: "unknown" });
    if (button.hasAttribute("data-board-source-profile")) {
      periodView.profileReturnLevel = periodView.level;
      state.coverageCompany = button.dataset.boardSourceProfile;
      state.page = "company-sources";
      document.querySelector("#boardProfileReturn").hidden = false;
      renderCompanySourceCoverage(); renderPage(); window.scrollTo(0, 0); return;
    }
    if (button.hasAttribute("data-board-refresh")) { if (!els.refreshButton.classList.contains("is-loading")) loadData(); return; }
    if (button.hasAttribute("data-board-more")) { periodView.limit += 40; renderBoardDetail(boardItems()); return; }
    if (button.hasAttribute("data-board-company-scope")) { periodView.route.history = button.dataset.boardCompanyScope === "history"; periodView.limit = 40; writeBoardUrl(); renderPeriodOverview(); return; }
    if (button.hasAttribute("data-board-tab")) { periodView.companyTab = button.dataset.boardTab; renderPeriodOverview(); return; }
    if (button.hasAttribute("data-board-language")) {
      periodView.language = button.dataset.boardLanguage;
      state.translationLanguage = periodView.language;
      saveTranslationLanguage(periodView.language);
      writeBoardUrl("replace"); renderTranslationToggle(); renderPeriodOverview(); return;
    }
    if (button.hasAttribute("data-board-mode")) periodView.mode = button.dataset.boardMode;
    if (button.hasAttribute("data-board-shift")) periodView.anchor = periodModel.shift(boardRange(), Number(button.dataset.boardShift));
    if (button.hasAttribute("data-board-current")) periodView.anchor = boardToday();
    if (button.hasAttribute("data-board-regions-all")) periodView.regions = [];
    if (button.hasAttribute("data-board-clear")) Object.assign(periodView, { regions: [], category: "all", topic: "all", company: "all", role: "all", query: "", relevance: "all", signalType: "all" });
    periodView.route = periodView.level === "records" ? { type: "list", value: "all", history: true } : null; state.page = periodView.route ? "period-detail" : boardRootPage(); writeBoardUrl(); renderPeriodOverview(); renderPage();
  });
  document.querySelector("#periodControls").addEventListener("change", event => {
    const target = event.target;
    if (target.id === "boardWeekDate") {
      if (!periodModel.date(target.value)) return syncBoardControls();
      periodView.anchor = target.value;
    } else if (target.id === "boardMonthDate") {
      if (!periodModel.date(`${target.value}-01`)) return syncBoardControls();
      periodView.anchor = `${target.value}-01`;
    } else if (target.hasAttribute("data-board-region") || target.hasAttribute("data-board-region-parent")) {
      fusionToggleRegionFamily("board", target);
      periodView.regions = [...document.querySelectorAll("[data-board-region]:checked")].map(input => input.value);
    } else {
      const key = { boardCategory: "category", boardTopic: "topic", boardCompany: "company", boardRole: "role", boardQuery: "query", boardSignalType: "signalType", boardRelevance: "relevance" }[target.id];
      if (!key) return;
      periodView[key] = target.value;
    }
    periodView.route = periodView.level === "records" ? { type: "list", value: "all", history: true } : null; state.page = periodView.route ? "period-detail" : boardRootPage(); writeBoardUrl(); renderPeriodOverview(); renderPage();
  });
  document.querySelector("#boardProfileReturn").addEventListener("click", () => {
    document.querySelector("#boardProfileReturn").hidden = true;
    periodView.level = periodView.profileReturnLevel || "period";
    openBoardRoute(periodView.route);
  });
  window.addEventListener("popstate", () => {
    if (!location.hash) { periodView.level = "main"; periodView.route = null; state.page = "overview"; renderOverviewScope(); renderPage(); return; }
    if (restoreBoardUrl()) { renderPeriodOverview(); renderPage(); window.scrollTo(0, periodView.route ? 0 : periodView.scroll); }
  });
}
