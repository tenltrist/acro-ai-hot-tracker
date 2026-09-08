const periodModel = window.AIHOT_OVERVIEW_MODEL;
const periodView = {
  mode: "week", anchor: "", regions: [], category: "all", topic: "all", company: "all",
  role: "all", query: "", companyTab: "competitor", route: null, limit: 40,
  events: [], payload: null, archive: null, scroll: 0,
};
const boardRegions = [
  ["japan", "日本"], ["china", "中国"], ["korea", "韩国"], ["southeast_asia", "东南亚"],
  ["north_america", "北美"], ["europe", "欧洲"], ["global", "全球（明确提及）"], ["unknown", "地区未识别"],
];
const boardRegionLabel = value => boardRegions.find(([id]) => id === value)?.[1] || value;
const boardTopicLabel = value => value === "unidentified" ? "主题未识别" : value;
const boardCompany = id => (state.payload?.companies || []).find(company => company.id === id);
const boardCompanyName = id => boardCompany(id)?.display_name || id;
const boardToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const boardRange = () => periodModel.period(periodView.mode, periodView.anchor || boardToday());
const boardRangeText = () => `${boardRange().start} 至 ${boardRange().end}`;
const boardScope = () => ({ ...periodView, today: boardToday() });

function boardEventRegions(item) {
  // Company headquarters and connector labels are not event locations.
  const text = `${item.title || ""} ${item.summary || ""}`;
  const matches = regionPatterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
  if (/\bglobal(?:ly)?\b|worldwide|全球|全世界/i.test(text)) matches.push("global");
  return matches.length ? matches : ["unknown"];
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

function boardItems(mode = "period") {
  return periodModel.select(periodView.events, boardScope(), boardRange(), mode);
}

function boardEventTitle(event) {
  const item = event.item;
  // Do not replace a concrete untranslated headline with a generic company/category label.
  return periodView.language === "en" ? item.title : item.title_zh || item.title || "标题缺失";
}

function boardSummary(event) {
  const item = event.item;
  if (item.summary_method === "manual_ai") {
    const summary = periodView.language === "en" ? item.ai_summary_en : item.ai_summary;
    if (summary) return { text: summary, label: "精读摘要（含分析，非新增事实）" };
  }
  if (item.summary && !isLowInformationSummary(item.summary, item.title)) return { text: item.summary, label: "来源摘录 · 未另行翻译" };
  return { text: "暂无独立正文摘录；当前仅有标题与来源，具体内容需查看原文。", label: "正文信息不足" };
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
    <small class="board-source-line">${escapeHtml(boardSourceHost(event))} · ${event.evidence.length} 个原文链接</small></div>
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
    <span class="company-name-with-logo">${companyLogoMarkup(company)}<strong>${escapeHtml(compactCompanyName(company))}</strong></span>
    <b>${events.length}</b><span>${escapeHtml(periodModel.buckets(events, "category").slice(0, 2).map(([value, count]) => `${labelBusinessEvent(value, true)} ${count}`).join(" · "))}</span><time>${events[0].published || "待核对"}</time>
  </button>`).join("")}</div>`;
}

function boardFilterSummary() {
  const values = [boardRangeText()];
  if (periodView.regions.length) values.push(periodView.regions.map(boardRegionLabel).join("、"));
  if (periodView.category !== "all") values.push(labelBusinessEvent(periodView.category));
  if (periodView.topic !== "all") values.push(boardTopicLabel(periodView.topic));
  if (periodView.role !== "all") values.push(labelRole(periodView.role));
  if (periodView.company !== "all") values.push(boardCompanyName(periodView.company));
  if (periodView.query) values.push(`搜索：${periodView.query}`);
  return values.join(" · ");
}

function syncBoardControls() {
  if (["overview", "period-detail"].includes(state.page)) {
    const selectedCompany = boardCompany(periodView.company);
    state.company = selectedCompany?.display_name || "all";
    els.companyFilter.value = state.company;
    renderCompanyDock();
  }
  const root = document.querySelector("#periodControls");
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
  document.querySelector("#boardFilterScope").textContent = boardFilterSummary();
  document.querySelector("#boardRegionsSummary").textContent = periodView.regions.length ? periodView.regions.map(boardRegionLabel).join("、") : "全部地区";
  root.querySelectorAll("[data-board-region]").forEach(input => { input.checked = periodView.regions.includes(input.value); });
  for (const [id, key] of [["boardCategory", "category"], ["boardTopic", "topic"], ["boardCompany", "company"], ["boardRole", "role"]]) document.getElementById(id).value = periodView[key];
  if (document.activeElement?.id !== "boardQuery") document.querySelector("#boardQuery").value = periodView.query;
  document.querySelectorAll("[data-board-language]").forEach(button => {
    const active = button.dataset.boardLanguage === periodView.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function hydrateBoardFilters() {
  const companySelect = document.querySelector("#boardCompany");
  const companies = sortCompaniesForDisplay(state.payload.companies || []);
  companySelect.innerHTML = '<option value="all">全部公司</option>' + companies.map(company => `<option value="${escapeAttr(company.id)}">${escapeHtml(compactCompanyName(company))}</option>`).join("");
  const categories = Object.keys(businessEventDefinitions);
  document.querySelector("#boardCategory").innerHTML = '<option value="all">全部商业事件</option>' + categories.map(value => `<option value="${value}">${escapeHtml(labelBusinessEvent(value))}</option>`).join("");
  const topics = [...new Set(periodView.events.flatMap(event => event.topics))].sort();
  document.querySelector("#boardTopic").innerHTML = '<option value="all">全部产品 / 技术主题</option>' + topics.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(boardTopicLabel(value))}</option>`).join("");
}

function renderPeriodOverview() {
  if (!state.payload) return;
  if (!periodView.anchor) periodView.anchor = boardToday();
  if (!periodView.language) periodView.language = state.translationLanguage;
  const prior = periodView.payload;
  refreshPeriodEvents();
  if (prior !== state.payload) hydrateBoardFilters();
  const items = boardItems();
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
  document.querySelector("#boardPeriodStatus").textContent = range.start > boardToday() ? "未来周期，尚未覆盖" : range.end > asOf ? "本期尚未结束 / 数据截至最近采集" : "历史周期 · 已保留记录";
  const metrics = [["all", "事件记录", items.length, "同链接 / 同日同标题保守合并"], ["companies", "涉及公司", companies.length, "本期命中监测公司"], ["products", "产品与技术动态", products.length, "产品平台与靶点技术"], ["partnerships", "合作与交易动态", partnerships.length, "合作、授权及交易报道"]];
  document.querySelector("#boardMetrics").innerHTML = metrics.map(([key, label, count, note]) => `<button type="button" class="board-metric" data-board-list="${key}" data-board-count="${key}"><span>${label}</span><strong>${count}</strong><small>${note}</small><i aria-hidden="true">→</i></button>`).join("");
  const top = periodModel.buckets(items, "category")[0];
  document.querySelector("#boardPeriodBrief").textContent = items.length ? `本期已保留 ${items.length} 条事件记录，涉及 ${companies.length} 家监测公司。${top ? `主要变化为${labelBusinessEvent(top[0])}（${top[1]} 条）。` : ""}` : "当前范围没有已保留的事件记录。请结合历史覆盖提示判断。";
  document.querySelector("#boardTrend").innerHTML = renderBoardTrend(items);
  document.querySelector("#boardCategoryBars").innerHTML = boardBars(items, "category", labelBusinessEvent);
  document.querySelector("#boardTopicBars").innerHTML = boardBars(items, "topics", boardTopicLabel, 6);
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
  if (!route) return "周期总览";
  if (route.type === "company") return compactCompanyName(boardCompany(route.value) || { id: route.value });
  if (route.type === "event") return "事件与证据";
  if (route.field === "category") return labelBusinessEvent(route.value);
  if (route.field === "topics") return boardTopicLabel(route.value);
  if (route.field === "published") return `${route.value} 发布记录`;
  return { all: "全部事件", companies: "涉及公司", products: "产品与技术动态", partnerships: "合作与交易动态", unknown: "日期待核对" }[route.value] || "事件明细";
}

function boardRouteItems(route, scoped) {
  let items = route.value === "unknown" ? boardItems("unknown") : scoped;
  if (route.type === "company") {
    items = route.history ? boardItems("history") : scoped;
    return items.filter(event => event.companyIds.includes(route.value));
  }
  if (route.field) return items.filter(event => Array.isArray(event[route.field]) ? event[route.field].includes(route.value) : event[route.field] === route.value);
  if (route.value === "products") return items.filter(event => ["product_platform", "target_therapy"].includes(event.category));
  if (route.value === "partnerships") return items.filter(event => event.category === "partnership_deal");
  return items;
}

function renderBoardDetail(scoped) {
  const route = periodView.route;
  if (!route) return;
  const host = document.querySelector("#periodDetail");
  const parent = route.type === "event" ? route.parent : null;
  const breadcrumbs = `<nav class="board-breadcrumbs" aria-label="当前位置"><button type="button" data-board-home>总览</button><span>/</span><span>${escapeHtml(boardRangeText())}</span>${parent ? `<span>/</span><button type="button" data-board-parent>${escapeHtml(boardRouteLabel(parent))}</button>` : ""}<span>/</span><strong aria-current="page">${escapeHtml(boardRouteLabel(route))}</strong></nav>`;
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
        <div class="board-company-links">${event.companyIds.map(id => `<button type="button" data-board-company="${escapeAttr(id)}" class="company-name-with-logo">${companyLogoMarkup(boardCompany(id))}<span>${escapeHtml(boardCompanyName(id))}</span></button>`).join("") || "尚未命中监测公司"}</div>
        <dl class="board-facts"><div><dt>新闻发布时间</dt><dd>${event.published || "未确认"}</dd></div><div><dt>事件发生时间</dt><dd>${event.eventDate || "未确认，不以发布日期替代"}</dd></div><div><dt>产品 / 技术主题</dt><dd>${escapeHtml(event.topics.map(boardTopicLabel).join("、"))}</dd></div><div><dt>事件地区</dt><dd>${escapeHtml(event.regions.map(boardRegionLabel).join("、"))}<small>来自原文标题 / 摘录的地区词，不使用公司总部推定</small></dd></div></dl>
        ${!event.published && sourceDate ? `<p class="board-notice">来源日期字段为 ${sourceDate}：${sourceDateMeaning}；不计入周期统计。</p>` : ""}
        <section class="board-detail-band"><h3>${summary.label}</h3><p class="board-full-summary">${escapeHtml(summary.text)}</p></section>
        ${event.category === "partnership_deal" ? `<section class="board-detail-band"><h3>合作内容与参与方</h3><p>${escapeHtml(raw.title)}</p><p class="board-muted">标题 / 摘录是当前关系证据；命中多家公司不等于已确认它们互为合作方。未核实的合作对象、条款与阶段不补猜。</p></section>` : ""}
        <section class="board-detail-band"><h3>原始证据 <small>${event.evidence.length} 个链接</small></h3><ol class="board-evidence-links">${event.evidence.map(source => `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(new URL(source.url).hostname)} <span aria-hidden="true">↗</span></a><small>${escapeHtml(source.labels.join(" / "))}</small><a class="board-source-url" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a></li>`).join("") || "<li>暂无有效原文链接</li>"}</ol></section>
        <details class="board-original"><summary>合并与记录口径</summary><p>${event.reports.length} 条记录按相同链接或同日同标题保守合并，保留 ${event.evidence.length} 个原文链接。来源入口数不等于独立报道数；跨语言与相近标题尚未自动合并。</p></details>
      </article>`;
    }
  } else {
    const items = boardRouteItems(route, scoped);
    const company = route.type === "company" ? boardCompany(route.value) : null;
    body = `<header class="board-detail-heading"><div>${company ? `<div class="company-name-with-logo">${companyLogoMarkup(company, "profile")}<h2>${escapeHtml(company.display_name)}</h2></div><p>${company.business_role === "customer" ? "日本市场监测账户；不代表已确认客户或已有交易。" : escapeHtml(company.role_label || labelRole(company.business_role))}</p>` : `<h2>${escapeHtml(boardRouteLabel(route))}</h2>`}<p>${escapeHtml(route.history ? "全部已保留历史，沿用当前地区、商业事件与主题筛选；未确认日期置后。历史覆盖不完整。" : route.value === "unknown" ? "日期待核对，沿用当前非时间筛选；这些记录不计入任何周期统计。" : boardFilterSummary())}</p></div><strong data-board-result-count="${items.length}">${items.length}<small>事件记录</small></strong></header>
      ${company ? `<div class="board-company-history"><div class="segmented-control"><button type="button" data-board-company-scope="period" class="${!route.history ? "active" : ""}">本期记录</button><button type="button" data-board-company-scope="history" class="${route.history ? "active" : ""}">已保留历史</button></div><button type="button" class="text-button" data-board-source-profile="${escapeAttr(company.id)}">数据源档案 →</button></div>` : ""}
      ${route.value === "companies" ? `<div class="board-company-directory">${[...new Set(items.flatMap(event => event.companyIds))].map(id => `<button type="button" data-board-company="${escapeAttr(id)}" class="company-name-with-logo">${companyLogoMarkup(boardCompany(id))}<strong>${escapeHtml(compactCompanyName(boardCompany(id)))}</strong><span>${items.filter(event => event.companyIds.includes(id)).length} 条</span></button>`).join("")}</div>` : ""}
      ${boardEventRows(items, periodView.limit)}${items.length > periodView.limit ? `<button type="button" class="text-button board-load-more" data-board-more>再显示 ${Math.min(40, items.length - periodView.limit)} 条（已显示 ${periodView.limit} / ${items.length}）</button>` : ""}`;
  }
  host.innerHTML = `<div class="board-detail-nav"><button type="button" class="methodology-back-button" data-board-back><span aria-hidden="true">←</span> 返回</button>${breadcrumbs}</div>${body}`;
}

function writeBoardUrl(mode = "push") {
  const query = new URLSearchParams({ mode: periodView.mode, date: periodView.anchor, lang: periodView.language || state.translationLanguage });
  for (const key of ["category", "topic", "company", "role", "query"]) if (periodView[key] && periodView[key] !== "all") query.set(key, periodView[key]);
  if (periodView.regions.length) query.set("regions", periodView.regions.join(","));
  if (periodView.route) query.set("view", JSON.stringify(periodView.route));
  const hash = `#board?${query}`;
  if (location.hash === hash) return;
  history[mode === "replace" ? "replaceState" : "pushState"]({ page: "overview", scroll: periodView.scroll }, "", location.pathname + location.search + hash);
}

function restoreBoardUrl() {
  if (!location.hash.startsWith("#board?")) return false;
  const params = new URLSearchParams(location.hash.slice(7));
  periodView.mode = params.get("mode") === "month" ? "month" : "week";
  periodView.anchor = periodModel.date(params.get("date")) || boardToday();
  periodView.language = ["en", "zh"].includes(params.get("lang")) ? params.get("lang") : state.translationLanguage;
  for (const key of ["category", "topic", "company", "role"]) periodView[key] = params.get(key) || "all";
  periodView.query = params.get("query") || "";
  periodView.regions = (params.get("regions") || "").split(",").filter(id => boardRegions.some(([value]) => value === id));
  try { periodView.route = JSON.parse(params.get("view") || "null"); } catch { periodView.route = null; }
  if (periodView.route && !["list", "event", "company"].includes(periodView.route.type)) periodView.route = null;
  periodView.limit = 40;
  state.page = periodView.route ? "period-detail" : "overview";
  return true;
}

function openBoardRoute(route, mode = "push") {
  if (!periodView.route) periodView.scroll = window.scrollY;
  periodView.route = route;
  periodView.limit = 40;
  state.page = route ? "period-detail" : "overview";
  writeBoardUrl(mode);
  renderPeriodOverview();
  renderPage();
  window.scrollTo({ top: route ? 0 : periodView.scroll, behavior: "instant" });
  if (route) document.querySelector("#periodDetail h2")?.focus({ preventScroll: true });
}

function initPeriodOverview() {
  periodView.anchor = boardToday();
  restoreBoardUrl();
  const compactFilters = window.matchMedia("(max-width: 650px)");
  document.querySelector("#boardFilterPanel").open = !compactFilters.matches;
  compactFilters.addEventListener("change", event => { document.querySelector("#boardFilterPanel").open = !event.matches; });
  document.querySelector("#boardRegionsList").innerHTML = boardRegions.map(([id, name]) => `<label><input type="checkbox" value="${id}" data-board-region />${name}</label>`).join("");
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-board-list], [data-board-field], [data-board-event], [data-board-company], [data-board-back], [data-board-home], [data-board-parent], [data-board-unknown], [data-board-more], [data-board-company-scope], [data-board-source-profile], [data-board-tab], [data-board-mode], [data-board-shift], [data-board-current], [data-board-clear], [data-board-regions-all], [data-board-language], [data-board-refresh]");
    if (!button) return;
    if (button.hasAttribute("data-board-list")) return openBoardRoute({ type: "list", value: button.dataset.boardList });
    if (button.hasAttribute("data-board-field")) return openBoardRoute({ type: "list", field: button.dataset.boardField, value: button.dataset.boardValue });
    if (button.hasAttribute("data-board-event")) return openBoardRoute({ type: "event", value: button.dataset.boardEvent, parent: periodView.route?.type !== "event" ? periodView.route : periodView.route.parent });
    if (button.hasAttribute("data-board-company")) return openBoardRoute({ type: "company", value: button.dataset.boardCompany });
    if (button.hasAttribute("data-board-back") || button.hasAttribute("data-board-parent")) return openBoardRoute(periodView.route?.parent || null);
    if (button.hasAttribute("data-board-home")) return openBoardRoute(null);
    if (button.hasAttribute("data-board-unknown")) return openBoardRoute({ type: "list", value: "unknown" });
    if (button.hasAttribute("data-board-source-profile")) {
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
    if (button.hasAttribute("data-board-clear")) Object.assign(periodView, { regions: [], category: "all", topic: "all", company: "all", role: "all", query: "" });
    periodView.route = null; state.page = "overview"; writeBoardUrl(); renderPeriodOverview(); renderPage();
  });
  document.querySelector("#periodControls").addEventListener("change", event => {
    const target = event.target;
    if (target.id === "boardWeekDate") {
      if (!periodModel.date(target.value)) return syncBoardControls();
      periodView.anchor = target.value;
    } else if (target.id === "boardMonthDate") {
      if (!periodModel.date(`${target.value}-01`)) return syncBoardControls();
      periodView.anchor = `${target.value}-01`;
    } else if (target.hasAttribute("data-board-region")) {
      periodView.regions = [...document.querySelectorAll("[data-board-region]:checked")].map(input => input.value);
    } else {
      const key = { boardCategory: "category", boardTopic: "topic", boardCompany: "company", boardRole: "role", boardQuery: "query" }[target.id];
      if (!key) return;
      periodView[key] = target.value;
    }
    periodView.route = null; state.page = "overview"; writeBoardUrl(); renderPeriodOverview(); renderPage();
  });
  document.querySelector("#boardProfileReturn").addEventListener("click", () => {
    document.querySelector("#boardProfileReturn").hidden = true;
    openBoardRoute(periodView.route);
  });
  window.addEventListener("popstate", () => {
    if (restoreBoardUrl()) { renderPeriodOverview(); renderPage(); window.scrollTo(0, periodView.route ? 0 : periodView.scroll); }
  });
}
