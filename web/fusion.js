const fusion = { regions: [], topic: "all", regionMode: "reviewed", detail: null, homeScroll: 0, directoryScope: null };
const fusionIsHomeContext = () => ["overview", "overview-metric", "fusion-evidence"].includes(state.page);

function fusionRegionEvidence(item) {
  return window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode).evidence;
}

function fusionRegions(item) {
  return window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode).regions;
}

const fusionReviewLabels = { identified: "有地区依据", nonregional: "内容未限定地区", pending: "已判读，地区证据不足" };
const fusionRegionGroupLabels = { located: "有地区依据", reviewed: "已逐条判读", unreviewed: "尚未逐条判读", inactive: "已存判读未启用" };

function fusionSemanticReviewMarkup(review) {
  return `<div class="fusion-semantic-review" data-region-review-status="${escapeAttr(review.status)}"><p><b>AI 地区判读 · ${fusionReviewLabels[review.status]}</b> · ${escapeHtml(review.checkedAt)}</p><p>${escapeHtml(review.note)}</p><p><b>核对范围：</b>${escapeHtml(review.scope)}</p>${review.evidence.map(source => `<p>${source.regions.length ? `<b>${source.regions.map(labelRegion).map(escapeHtml).join(" / ")}</b> · ` : ""}${escapeHtml(source.kind)} · ${escapeHtml(source.material === "snapshot" ? "标题 / 摘录依据，未读全文" : { explicit: "原文明确", contextual: "AI 上下文判断", limited: "材料有限" }[source.quality])}${source.quote ? `<br>“${escapeHtml(source.quote)}”` : ""}<br><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${source.quality === "limited" || source.material === "snapshot" ? "来源入口（未完整读取）" : "查看依据原文"} ↗</a>${source.contextUrl ? ` · <a href="${escapeAttr(source.contextUrl)}" target="_blank" rel="noopener noreferrer">核对机构所在地 ↗</a>` : ""}</p>`).join("")}</div>`;
}

function fusionRegionMarkup(item) {
  const result = window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode);
  const evidence = result.evidence.filter(hit => hit.field !== "semantic");
  const regions = result.regions;
  const accepted = evidence.filter(hit => hit.accepted);
  const rejected = evidence.filter(hit => !hit.accepted);
  const markup = hit => `<p><b>${escapeHtml(labelRegion(hit.region))}</b> · ${escapeHtml(hit.label)} · ${escapeHtml(hit.kind)}<br>“${escapeHtml(hit.word)}”${hit.note ? `<br>${escapeHtml(hit.note)}` : ""}${hit.rejected ? `（未计入：${escapeHtml(hit.rejected)}）` : ""}${hit.url ? ` <a href="${escapeAttr(hit.url)}" target="_blank" rel="noopener noreferrer">${hit.checkedAt ? `核对原文 · ${hit.checkedAt}` : "监管机构说明"} ↗</a>` : ""}</p>`;
  const reason = window.AIHOT_REGION_MODEL.reasons.find(row => row.id === result.reason);
  return `<details class="fusion-region-evidence"><summary>${regions.map(labelRegion).map(escapeHtml).join(" / ")} <small>${result.review ? "AI 判读依据" : "地区依据"}</small></summary><div>${result.review ? fusionSemanticReviewMarkup(result.review) : accepted.length ? accepted.map(markup).join("") : `<p>${escapeHtml(reason?.label || "暂无明确地区词")}：${escapeHtml(reason?.note || "")}</p>`}${rejected.length ? `<details><summary>未计入的辅助线索 ${rejected.length} 项</summary>${rejected.map(markup).join("")}</details>` : ""}<p>这是新闻的地理关联，具体关系以每条依据为准，不等于统一的事件发生地或已获批地区。</p></div></details>`;
}

function fusionAge(item) {
  const published = periodModel.publicationDate(item);
  const asOf = periodModel.date(state.payload.generated_at);
  if (!published || !asOf) return null;
  return Math.round((Date.parse(asOf + "T00:00:00Z") - Date.parse(published + "T00:00:00Z")) / 86400000);
}

function fusionWithinRange(item, days) {
  const age = fusionAge(item);
  return age !== null && age >= 0 && age < days;
}

function fusionMatchesRegion(item, homeScope = fusionIsHomeContext()) {
  const requested = homeScope ? fusion.regions : state.region === "all" ? [] : [state.region];
  return !requested.length || fusionRegions(item).some(region => requested.includes(region));
}

function fusionRangeLabel() {
  const end = periodModel.date(state.payload.generated_at);
  return `${periodModel.offset(end, 1 - state.timeRange)} 至 ${end}`;
}

function fusionSyncControls(items) {
  els.roleControl.querySelectorAll("[data-role-filter]").forEach(button => {
    const active = button.dataset.roleFilter === state.role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#fusionRegionLabel").textContent = fusionRegionSelectionLabel(fusion.regions);
  document.querySelector("#fusionRegionMode").value = fusion.regionMode;
  document.querySelector("#fusionCategory").innerHTML = els.categoryFilter.innerHTML;
  document.querySelector("#fusionCategory").value = state.category;
  const topics = [...new Set(state.payload.items.flatMap(fusionTopics))].sort((a, b) => Number(a === "unidentified") - Number(b === "unidentified") || a.localeCompare(b));
  document.querySelector("#fusionProduct").innerHTML = '<option value="all">全部产品 / 技术</option>' + topics.map(topic => `<option value="${escapeAttr(topic)}">${escapeHtml(boardTopicLabel(topic))}</option>`).join("");
  document.querySelector("#fusionProduct").value = fusion.topic;
  document.querySelectorAll("[data-fusion-region]").forEach(input => { input.checked = fusion.regions.includes(input.value); });
  fusionSyncRegionFamily("fusion", fusion.regions);
  const scope = `${fusionRangeLabel()} · ${getOverviewScopeLabel()}`;
  document.querySelector("#fusionScope").textContent = `${scope} · ${items.length} 条情报记录`;
  document.querySelector("#fusionMatrixScope").textContent = `同当前筛选 · 核心竞品 · 一条可命中多家公司`;
  document.querySelector("#fusionTotals").innerHTML = `<button type="button" data-fusion-all>本期新闻 <strong>${items.length}</strong></button><span>${fusionCompanyIds(items).length} 家监测公司涉及本期新闻</span>`;
}

function fusionRegionSelectionLabel(selected) {
  const model = window.AIHOT_REGION_MODEL;
  if (!selected.length || model.definitions.every(row => selected.includes(row.id))) return "全部地区";
  const allApac = model.apac.every(id => selected.includes(id));
  return [...(allApac ? ["亚太（全部）"] : []), ...selected.filter(id => !allApac || !model.apac.includes(id)).map(labelRegion)].join(" / ");
}

function fusionRegionOptions(prefix) {
  const model = window.AIHOT_REGION_MODEL;
  const option = id => `<label><input type="checkbox" data-${prefix}-region value="${id}" />${escapeHtml(labelRegion(id))}</label>`;
  return `<div class="region-filter-family"><label class="region-filter-parent"><input type="checkbox" data-${prefix}-region-parent="apac" />亚太（全部）</label><div class="region-filter-children">${model.apac.map(option).join("")}</div></div>${model.families.filter(row => row.id !== "apac").map(row => option(row.id)).join("")}<div class="region-filter-scopes"><span>范围证据</span>${model.scopeIds.map(option).join("")}</div><div class="region-filter-scopes"><span>其他记录</span>${["nonregional", "unknown"].map(option).join("")}</div>`;
}

function fusionSyncRegionFamily(prefix, selected) {
  const input = document.querySelector(`[data-${prefix}-region-parent="apac"]`);
  if (!input) return;
  const count = window.AIHOT_REGION_MODEL.apac.filter(id => selected.includes(id)).length;
  input.checked = count === window.AIHOT_REGION_MODEL.apac.length;
  input.indeterminate = count > 0 && !input.checked;
}

function fusionToggleRegionFamily(prefix, target) {
  if (!target.hasAttribute(`data-${prefix}-region-parent`)) return;
  document.querySelectorAll(`[data-${prefix}-region]`).forEach(input => {
    if (window.AIHOT_REGION_MODEL.apac.includes(input.value)) input.checked = target.checked;
  });
}

function fusionUniqueItems(items) {
  return [...new Map(items.map(item => [item.id || item.url, item])).values()];
}

function fusionRecent(items) {
  const order = item => {
    const date = periodModel.publicationDate(item);
    if (!date) return -Infinity;
    const raw = String(item.published_at || item.published || "");
    const timestamp = /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? Date.parse(raw) : NaN;
    return Number.isFinite(timestamp) ? timestamp : Date.parse(`${date}T00:00:00Z`);
  };
  return [...items].sort((a, b) => order(b) - order(a) || String(a.id).localeCompare(String(b.id)));
}

function fusionLatest(items) {
  return fusionRecent(items.filter(item => periodModel.publicationDate(item))).slice(0, 3);
}

function fusionDateLabel(item) {
  const date = periodModel.publicationDate(item);
  return date ? `${state.translationLanguage === "en" ? "Published" : "发布"} ${date}` : state.translationLanguage === "en" ? "Publication date unconfirmed" : "发布日期待核对";
}

function fusionCompanyIds(items) {
  const known = new Set((state.payload.companies || []).map(company => company.id));
  return [...new Set(items.flatMap(item => item.matched_company_ids || []).filter(id => known.has(id)))];
}

function fusionSummary(item, language = state.translationLanguage) {
  const en = language === "en";
  const fitsLanguage = text => en ? /[a-z]{3}/i.test(text) && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(text) : /[\u4e00-\u9fff]/.test(text) && !/[\u3040-\u30ff]/.test(text);
  const meaningful = text => {
    const factual = fusionFactualText(text);
    return Boolean(factual && !isLowInformationSummary(factual, item.title) && !isLowInformationSummary(factual, item.title_zh || item.title));
  };
  const generated = ["manual_ai", "llm"].includes(item.summary_method);
  const processed = String(en ? item.ai_summary_en || "" : item.ai_summary || "").trim();
  const editorial = item.summary_method === "manual_ai";
  const editorialText = fusionFactualText(processed);
  const editorialRepeatsTitle = [item.title, item.title_zh]
    .map(normalizeSummaryForCompare)
    .filter(Boolean)
    .includes(normalizeSummaryForCompare(editorialText));
  const limited = /有限核对|仅.*(?:简介|短摘录)|只.*标题|Limited.*(?:preview|description)/i.test(`${item.summary_review?.scope_zh || ""} ${item.summary_review?.scope_en || ""}`);
  const template = /原始摘要要点|建议按[“"]|shows a .{0,60} signal|based on the original headline|This is a public .{0,60} signal/i;
  if (generated && (editorial ? Boolean(editorialText) && !editorialRepeatsTitle : meaningful(processed)) && fitsLanguage(processed) && !template.test(processed)) {
    return { text: processed, label: en ? "Summary" : "摘要", ai: false, limited };
  }
  const source = [en ? item.summary_en : item.summary_zh, item.evidence?.source_excerpt, item.summary]
    .map(value => String(value || "").trim()).find(text => meaningful(text) && fitsLanguage(text) && !template.test(text));
  if (source) {
    return { text: source, label: en ? "Summary" : "摘要", ai: false, limited: true };
  }
  return { text: en ? "No usable English summary is available. See the original source." : "暂无可用中文摘要，请查看原文。", label: en ? "Summary" : "摘要", ai: false, missing: true };
}

function fusionFactualText(text) {
  // Omit legacy imperative sentences only in overview presentation; stored reviews remain intact.
  const task = /建议按|建议动作|应核对|优先跟进|必须联系|今天应|交给.{0,12}(?:销售|市场|团队)|销售话术|Suggested action|must contact|sales team should|technical support should/i;
  if (!task.test(String(text))) return String(text).trim();
  return String(text).split(/(?<=[。！？])|(?<=[.!?])\s+/).filter(sentence => !task.test(sentence)).join(" ").trim();
}

function fusionTopics(item) {
  const values = periodModel.topics(item);
  return values.length ? values : ["unidentified"];
}

function renderFusionTopics(items) {
  const buckets = new Map();
  for (const item of items) for (const topic of fusionTopics(item)) {
    if (!buckets.has(topic)) buckets.set(topic, []);
    buckets.get(topic).push(item);
  }
  const entries = [...buckets].sort((a, b) => Number(a[0] === "unidentified") - Number(b[0] === "unidentified") || b[1].length - a[1].length || a[0].localeCompare(b[0]));
  document.querySelector("#fusionTopicScope").textContent = `${items.length - (buckets.get("unidentified")?.length || 0)} / ${items.length} 条新闻识别出主题 · 多标签`;
  document.querySelector("#fusionTopicRows").innerHTML = entries.length ? entries.map(([topic, matches]) => `<button type="button" class="fusion-topic-row" data-fusion-topic="${escapeAttr(topic)}"><strong>${escapeHtml(boardTopicLabel(topic))}</strong><span>${matches.length} 条新闻</span><span>${fusionCompanyIds(matches).length} 家公司</span><small>查看相关新闻 →</small></button>`).join("") : '<p class="empty">当前范围没有新闻。</p>';
}

function fusionAccountRows(items) {
  const index = fusionScopedAccountIndex(items);
  const priorities = new Map(buildCustomerAccountPriorities(state.timeRange, items).map(row => [row.company.id, row]));
  const companies = (state.payload.companies || []).filter(company => company.business_role === "customer");
  const rows = (getJapanAccountData().accounts || []).map(account => {
    const company = companies.find(company => findAccountForCompany(company)?.id === account.id);
    const matches = index.get(account.id) || [];
    return { key: account.id, name: account.name, account, company, items: matches, priority: priorities.get(company?.id) };
  });
  for (const company of companies.filter(company => !rows.some(row => row.company?.id === company.id))) {
    rows.push({ key: company.id, name: company.display_name, company, items: items.filter(item => (item.matched_company_ids || []).includes(company.id)), priority: priorities.get(company.id) });
  }
  return rows.filter(row => row.items.length).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

function renderFusionCustomers(items) {
  const rows = fusionAccountRows(items);
  els.customerPriorityScope.textContent = `${rows.length} 家账户 · ${fusionUniqueItems(rows.flatMap(row => row.items)).length} 条新闻 · 同当前筛选`;
  els.customerPriorityMatrix.innerHTML = rows.length ? `<div class="fusion-customer-header"><span>监测账户 / 最新事件</span><span>当前新闻</span><span>ACRO 相关密度</span><span>参考指数</span><span>证据</span></div>` + rows.map(row => {
    const latest = fusionRecent(row.items)[0];
    const priority = row.priority;
    return `<div class="fusion-customer-row" data-fusion-account-row="${escapeAttr(row.key)}">
      <div><strong class="company-name-with-logo">${companyLogoMarkup(row.company)}${escapeHtml(row.name)}</strong>
        <button type="button" class="fusion-event-link" data-fusion-item="${escapeAttr(latest.id)}">${escapeHtml(getDisplayTitle(latest))}</button>
        <small>${escapeHtml(fusionDateLabel(latest))} · ${escapeHtml(getSourceLabelText(latest))}</small></div>
      <button type="button" class="customer-priority-count" data-fusion-account="${escapeAttr(row.key)}"><strong>${row.items.length}</strong><small>相关新闻</small></button>
      <span class="customer-priority-density">${priority ? `${priority.density}%` : "未计算"}</span>
      <span class="fusion-reference-score">${priority ? `<button type="button" class="text-button" data-methodology-target="priority-index" aria-label="参考指数 ${priority.priorityScore}，查看原有规则">${priority.priorityScore}</button>` : "未计算"}</span>
      <button type="button" class="text-button" data-fusion-profile="${escapeAttr(row.key)}">公司详情 →</button></div>`;
  }).join("") : '<div class="empty">当前范围没有监测账户的公开新闻，不代表目录已删除或市场没有活动。</div>';
}

function fusionAssistantResponse(intent, items) {
  const scope = intent === "account" ? fusionUniqueItems(fusionAccountRows(items).flatMap(row => row.items)) : intent === "competitor" ? items.filter(item => getItemRole(item) === "competitor") : items;
  const recent = fusionLatest(scope);
  return { headline: intent === "account" ? "客户动态：本期公开事件" : intent === "competitor" ? "竞品动态：本期公开事件" : "本期市场信息与证据", actions: recent.map(item => ({ label: labelBusinessEvent(getBusinessEventType(item)), title: getDisplayTitle(item), detail: `${fusionDateLabel(item)} · ${getSourceLabelText(item)}`, company: "", category: "", evidenceIds: [item.id] })) };
}

function fusionDirectoryItems() {
  if (!fusion.directoryScope) return fusionUniqueItems(state.payload.items);
  const ids = new Set(fusion.directoryScope.ids);
  return fusionUniqueItems(state.payload.items.filter(item => ids.has(item.id)));
}

function fusionScopedAccountIndex(items = fusionDirectoryItems()) {
  const allowed = new Set(items.map(item => item.id));
  const index = new Map([...getJapanAccountSignalIndex()].map(([id, matches]) => [id, fusionUniqueItems(matches.filter(item => allowed.has(item.id)))]));
  for (const company of state.payload.companies.filter(company => company.business_role === "customer")) {
    const account = findAccountForCompany(company);
    if (!account) continue;
    index.set(account.id, fusionUniqueItems([...(index.get(account.id) || []), ...items.filter(item => (item.matched_company_ids || []).includes(company.id))]));
  }
  return index;
}

function fusionCompanyItems(companyId, items = fusionDirectoryItems()) {
  const company = state.payload.companies.find(company => company.id === companyId);
  const account = company && findAccountForCompany(company);
  return account && company.business_role === "customer" ? fusionScopedAccountIndex(items).get(account.id) || [] : items.filter(item => (item.matched_company_ids || []).includes(companyId));
}

function fusionOpenDirectory(page, accountId = "") {
  fusion.directoryScope = { ids: getFilteredItems().map(item => item.id), label: `${fusionRangeLabel()} · ${getOverviewScopeLabel()}` };
  if (accountId) { state.selectedAccountId = accountId; state.accountQuery = ""; state.accountStage = "all"; state.accountOrganizationType = "all"; state.accountSignalStatus = "all"; }
  state.page = page;
  renderJapanAccountIntelligence(); renderCompanyPools(); renderPage(); window.scrollTo(0, 0);
}

function fusionDirectoryBanner() {
  return fusion.directoryScope ? `<div class="fusion-directory-scope"><button type="button" data-fusion-back>← 返回总看板</button><span>总看板 / 客户动态 / 账户与公司档案 · 沿用 ${escapeHtml(fusion.directoryScope.label)}</span><button type="button" data-fusion-directory-all>查看全库动态</button></div>` : '<p class="fusion-scope">全库已采集新闻；账户目录数量与新闻数量分开统计。</p>';
}

function fusionSourceStages() {
  const rows = getSourceHealthRows();
  const labels = [["已配置", rows.length, "快照中登记的入口，不含方法库"], ["请求成功", rows.filter(row => row.operational_status === "reachable").length, "不代表有新闻命中"], ["实际命中", rows.filter(row => row.total > 0).length, "本轮至少1条进入数据集"], ["有效产出", rows.filter(row => row.daily + row.immediate > 0).length, "本轮至少1条通过既有门槛"]];
  document.querySelector("#fusionSourceStages").innerHTML = labels.map(([label, count, note]) => `<div><span>${label}</span><strong>${count}</strong><small>${note}</small></div>`).join("");
}

function fusionRegionChart(items) {
  const model = window.AIHOT_REGION_MODEL;
  const groups = model.partition(items, fusion.regionMode);
  const entries = regionDefinitions.filter(region => !["unknown", "nonregional"].includes(region.id)).map(region => [region, items.filter(item => fusionRegions(item).includes(region.id)).length]).sort((a, b) => b[1] - a[1]);
  const families = model.distribution(items, fusion.regionMode).sort((a, b) => b.items.length - a.items.length);
  const max = Math.max(1, ...families.map(row => row.items.length));
  const unknown = groups.pending.length;
  const nonregional = groups.nonregional.length;
  const row = ([region, count]) => `<button class="region-row fusion-chart-row" type="button" data-fusion-region-detail="${region.id}" ${count ? "" : "disabled"}><div><span>${escapeHtml(region.label)}</span><strong>${count}</strong></div><div class="region-track"><i style="width:${count / max * 100}%"></i></div></button>`;
  const leaf = id => entries.find(([region]) => region.id === id);
  const familyRow = family => {
    if (family.id !== "apac") return row(leaf(family.id));
    return `<div class="region-family"><button class="region-row fusion-chart-row" type="button" data-fusion-region-family="apac" ${family.items.length ? "" : "disabled"}><div><span>亚太</span><strong>${family.items.length}</strong></div><div class="region-track"><i style="width:${family.items.length / max * 100}%"></i></div></button><details class="region-family-breakdown"><summary>日本等地区明细</summary>${family.members.map(id => row(leaf(id))).join("")}</details></div>`;
  };
  const zero = families.filter(row => !row.items.length);
  els.regionBars.innerHTML = `<p class="fusion-region-coverage" data-region-total="${items.length}" data-region-unknown="${unknown}" data-region-nonregional="${nonregional}">${escapeHtml(fusionRangeLabel())} · 本期 <b>${items.length}</b> 条</p>
    <div class="region-chart-axis"><span>地区</span><span>新闻数量</span></div>
    <div class="fusion-geography-bars">${families.filter(row => row.items.length).map(familyRow).join("") || '<p class="fusion-scope">当前没有具体地区记录。</p>'}${zero.length ? `<details class="fusion-zero-regions"><summary>无命中地区 ${zero.length} 类</summary>${zero.map(familyRow).join("")}</details>` : ""}</div>
    <details class="region-scope-evidence"><summary>跨地区范围</summary>${model.scopeIds.map(id => { const [region, count] = leaf(id); return `<button type="button" data-fusion-region-detail="${id}" ${count ? "" : "disabled"}><span>${escapeHtml(region.label)}</span><strong>${count}</strong></button>`; }).join("")}</details>
    <div class="region-chart-other"><button type="button" data-fusion-region-detail="nonregional" ${nonregional ? "" : "disabled"}>不限定地区 <strong>${nonregional}</strong></button><button type="button" data-fusion-region-detail="unknown" ${unknown ? "" : "disabled"}>待确认 <strong>${unknown}</strong></button></div>
    <small class="fusion-region-footnote">同一新闻可涉及多个地区，合计不等于新闻总数。</small>`;
}

function fusionUnknownReasonRows(items) {
  return window.AIHOT_REGION_MODEL.reasons.map(reason => {
    const count = items.filter(item => window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode).reason === reason.id).length;
    return count ? `<button type="button" data-fusion-region-reason="${reason.id}"><span>${reason.label}</span><strong>${count}</strong><span aria-hidden="true">→</span></button>` : "";
  }).join("");
}

function openFusionRegionRules() {
  openMethodology("region-classification");
}

function renderFusionRegionRules() {
  const model = window.AIHOT_REGION_MODEL;
  const items = getFilteredItems(true);
  const unknown = items.filter(item => fusionRegions(item).includes("unknown")).length;
  const supplemented = items.filter(item => model.analyze(item, "reviewed").regions.some(region => !["unknown", "nonregional"].includes(region) && !model.analyze(item, "content").regions.includes(region))).length;
  const batch = items.filter(item => model.reviewFor(item));
  const batchEntries = model.semanticReviews.map(review => ({ review, records: batch.filter(item => model.reviewFor(item) === review) })).filter(row => row.records.length);
  document.querySelector("#regionRulesContent").innerHTML = `<div class="fusion-region-rules"><header><p class="eyebrow">地区规则 ${model.version}</p><h2>地区判读与统计</h2><p>${escapeHtml(fusionRangeLabel())} · ${escapeHtml(getOverviewScopeLabel())} · ${items.length} 条新闻，${unknown} 条地区待确认。</p></header>
    <p class="fusion-review-progress">${["located", "reviewed", "unreviewed"].map(key => { const count = model.partition(items, fusion.regionMode)[key].length; return `<button type="button" data-fusion-region-group="${key}" ${count ? "" : "disabled"}>${fusionRegionGroupLabels[key]} <b>${count}</b></button>`; }).join("")}</p>
    <section><h3>浏览方式与统计范围</h3><p>总览默认固定为数据快照截至日的近90天入选信息，沿用 daily 或 immediate 门槛，不再提供7／30／90天重复切换。周看板、月看板按自然周／月查看全部已保留事件，不按入选等级过滤，保留历史周期选择。历史记录分“全部记录／入选信息／其他留存资料”：全部记录均已保存，后两项是互斥的筛选结果。合并事件只要有一篇 daily 或 immediate 报道就计入入选信息，其余归入其他留存资料；缺失层级单独注明入选状态未确认，不冒充规则已拒绝。后台 archive 是筛选层级，不是保存动作。入选记录按可信发布日期进一步分为总览近90天内、范围外、日期未确认，三项相加等于入选总数；不使用抓取时间代替发布日期。四个顶部入口是浏览方式，不是四类互斥新闻；后台抓取频率与评分未改。</p><p>界面“监测对象”分本公司、竞品、客户；客户只是原客户类账户的显示简称，不代表已成交，不修改身份关系和日本账户库。产品／技术与地区、商业事件是独立维度。地区内多选取并集，跨维度取交集；未知产品主题保留，不用商业事件替代产品。来源与摘要的事实边界保持不变。</p></section>
    <section><h3>01 · 什么新闻进入统计</h3><p>沿用总看板当前时间、公司、入选层级、商业事件和地区筛选；不改评分门槛。按记录 ID 去重，与新闻列表一致，不是全网新闻量。地区维度内多选取并集，与其他维度取交集；未知地区不会被删除。</p><p>一条记录可计入多个地区，但在总数和亚太指标中只计一次。这里统计新闻的地理关联，可能是发生地、市场、合作方所在地、试验范围或监管辖区，不能全部理解为事件发生地。</p></section>
    <section><h3>02 · 哪些依据可以计入</h3><dl><div><dt>先定位事件</dt><dd>先判断哪个公司做了什么，再识别与本次事件直接相连的地域。保留实际地点、市场、监管辖区、合作研究机构或交易主体法域，分别写明关系，不将它们全部说成事件发生地。</dd></div><div><dt>明确词</dt><dd>原标题、已有来源摘录中的中 / 英 / 日国家、城市、地区表达；字段先作全半角归一。城市映射到地区，别名合并后同一地区只计一次。只读取标题／摘录时明确标注，不声称全文精读。</dd></div><div><dt>监管辖区</dt><dd>FDA、EMA / CHMP、PMDA / 厚生劳动省、TGA，必须关联审批、申请、审查、召回等具体事项。申请不等于获批；欧盟不等于整个欧洲，台湾许可不等于其他中国市场许可。IND 缩写本身不足以判为美国。</dd></div><div><dt>AI 语义判读</dt><dd>逐条阅读可用材料，保存地区与事件的具体关系、短引用、原文链接和实际阅读范围。国内需有公告主体及事件语境佐证；会议须匹配名称、年份和会址；合作方所在地仅作为合作关系，不自动视为研发地点。所有未来计划保留计划属性。</dd></div><div><dt>生效顺序</dt><dd>默认模式优先采用按记录 ID 和标题绑定的 AI 判读，可补充也可否定关键词旧结果；其他记录仍用明确线索及已有补证。切至仅标题 / 来源摘录会禁用语义判读。当前范围有 ${supplemented} 条获得地区补充；${fusion.regionMode === "reviewed" ? "当前已计入。" : "当前未计入。"}记录 ID 或标题改变不能直接套用旧判断，原文更新也需人工重新核对。</dd></div><div><dt>排除背景</dt><dd>公司国籍、新闻电头、联系地址、站点语言／域名、媒体名称、会议名称中的 Global、宣传词和已有 AI 摘要不能单独作为地区依据。历史获批国家、其他适应证、独立投资项目及明确排除地域不混进本次事件；若确有总部设施开业／系统部署动作，则保留该地点。</dd></div></dl></section>
    <section><h3>03 · 大区、下属地区与业务范围</h3><p>一级地区只用亚太、北美、欧洲、拉丁美洲、中东、非洲。亚太包含日本、中国及港澳台、韩国、东南亚、南亚、大洋洲；原文只写 APAC 也归入该父级。展开才看下属明细，同一新闻命中日本和澳大利亚，在亚太仍只计一次。选择亚太等于选择这些既有地区的并集，不新增新闻标签。</p><p>全球是范围说明，不是与国家并列的另一个地区。明确全球许可或供应可记全球业务范围，但不能推出每个国家都已落地；它不自动增加日本或其他地区的新闻量。亚洲没有列国家时保留原文范围，不增加一级分类，也不为了简化而猜作日本或等同 APAC。已明确的国家与大范围可以共存，但范围证据不与地区条形相加。</p><p>会议按同届主办方公布的会址归属：纽约归北美，东京归日本及亚太。线上直播加线下会址仍保留会址；纯线上且未限定受众时归内容不限定地区。会议名称中的 Global、主办公司国籍和发言时区不是会址。</p><details><summary>具体国家、市场与原始范围定义</summary><div class="fusion-region-taxonomy">${model.definitions.map(row => `<div><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.scope)}</span></div>`).join("")}</div></details></section>
    <section><h3>04 · 判读结果不是地理分类</h3><p>有地区依据、内容不限定地区、地区证据不足三者互斥，相加等于当前新闻总数。第一种包含具体地区和已明确的业务范围。各大区之间可能交叉，范围证据与大区也可能交叉，不能把这些分项直接相加。</p><p>先补查原始公告、同届会址或明确引用的同一合作协议，再记录剩余不足。材料不完整表示没有取得足够原文；已读原文但地点未明确只描述实际阅读结果，不声称公司从未披露。技术内容或纯线上活动确实不限定地域时单独保留，不等于全球。不能为清零指定国家，尚未判读是另一个工作进度；只读简介不代表看完视频或参考论文。</p><div class="fusion-region-reasons">${fusionUnknownReasonRows(items) || "当前筛选没有地区证据不足记录。"}</div></section>
    <section><h3>05 · AI 地区判读记录</h3><p>本批范围：${escapeHtml(model.reviewScope.start)} 至 ${escapeHtml(model.reviewScope.end)}，共 ${model.reviewScope.total} 条入选新闻（按记录 ID 去重），不是全库所有新闻。当前筛选已判读 ${batch.length} / ${items.length} 条。逐条核对标题和可用来源，必要时补原文；实际读取深度在各条记录中说明。这里只改变地区信息，不重写摘要、增添新闻或调整评分。这是已保存的 Codex 判读，不是网页实时调用 AI；未来抓取仍需补充复核。</p><div class="fusion-region-reasons">${Object.entries(fusionReviewLabels).map(([status, label]) => { const count = batch.filter(item => model.reviewFor(item).status === status).length; return count ? `<button type="button" data-fusion-region-review="${status}"><span>${label}</span><strong>${count}</strong><span aria-hidden="true">→</span></button>` : ""; }).join("")}</div>${fusion.regionMode !== "reviewed" ? "<p>目前仅查看标题 / 摘录模式，下列已保存判读未作用于统计。</p>" : ""}${batchEntries.map(({ review, records }) => `<details class="fusion-review-entry"><summary>${escapeHtml(records[0].title_zh || records[0].title)} · ${records.length} 条报道 · ${fusionReviewLabels[review.status]}</summary>${fusionSemanticReviewMarkup(review)}</details>`).join("")}</section>
    <section><h3>06 · 既有公告补证与监管参考</h3>${model.reviewed.map(entry => `<p><a href="${escapeAttr(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.kind)} · ${entry.regions.map(labelRegion).map(escapeHtml).join(" / ")} ↗</a><br>“${escapeHtml(entry.quote)}”<br>${escapeHtml(entry.note)}</p>`).join("")}<p>监管机构边界：${model.regulators.map(row => `<a href="${row.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.label)}</a>`).join(" · ")}</p></section></div>`;
}

function openFusionEvidence(title, items, options = {}) {
  if (state.page !== "fusion-evidence") fusion.homeScroll = window.scrollY;
  fusion.detail = { title, ids: fusionUniqueItems(items).map(item => item.id), scope: options.scope || (options.unknown ? `发布日期待核对，未计入周期 · ${getOverviewScopeLabel()}` : `${fusionRangeLabel()} · ${getOverviewScopeLabel()}`), order: options.order || "score", profile: options.profile || null, parentRules: options.parentRules || false };
  state.page = "fusion-evidence";
  history.pushState({ fusionDetail: fusion.detail }, "", "#fusion-evidence");
  renderFusionEvidence(); renderPage(); window.scrollTo(0, 0);
}

function renderFusionEvidence() {
  if (!fusion.detail) return;
  if (fusion.detail.kind === "region-rules") return renderFusionRegionRules();
  const ids = new Set(fusion.detail.ids);
  const matches = fusionUniqueItems(state.payload.items.filter(item => ids.has(item.id)));
  const items = fusion.detail.order === "date" ? fusionRecent(matches) : matches.sort((a, b) => b.score - a.score);
  document.querySelector("#fusionEvidence").innerHTML = `<div class="metric-detail-navigation"><button type="button" class="methodology-back-button" data-fusion-back>← 返回总看板</button><nav class="methodology-breadcrumb" aria-label="当前位置"><span>总看板</span><i>/</i><strong>${escapeHtml(fusion.detail.title)}</strong></nav></div><header class="fusion-evidence-heading"><h2>${escapeHtml(fusion.detail.title)}</h2><strong>${items.length} 条</strong><p>${escapeHtml(fusion.detail.scope)}</p></header><div class="signal-list" id="fusionEvidenceCards"></div>`;
  renderSignalCards(document.querySelector("#fusionEvidenceCards"), items, false);
  if (fusion.detail.parentRules) {
    const back = document.querySelector("#fusionEvidence [data-fusion-back]");
    back.removeAttribute("data-fusion-back"); back.setAttribute("data-fusion-region-rules", ""); back.textContent = "← 返回地区规则";
    document.querySelector("#fusionEvidence .methodology-breadcrumb strong").insertAdjacentHTML("beforebegin", "<span>分类与业务输出 / 地区判读与统计</span><i>/</i>");
    document.querySelector("#fusionEvidence .methodology-breadcrumb > span").textContent = "规则中心";
  }
  if (fusion.detail.profile) {
    const row = fusion.detail.profile;
    document.querySelector(".fusion-evidence-heading").insertAdjacentHTML("beforeend", `<p>监测账户，不代表已成交客户。${escapeHtml(row.organization || "")}</p>${row.accountId ? `<button type="button" class="text-button" data-fusion-directory-account="${escapeAttr(row.accountId)}">账户档案与公开关系证据 →</button>` : ""}`);
  }
}

function fusionHome() {
  state.timeRange = 90;
  periodView.level = "main";
  periodView.route = null;
  state.page = "overview";
  history.pushState({ page: "overview" }, "", location.pathname + location.search);
  renderOverviewScope(); renderPage(); window.scrollTo(0, fusion.homeScroll);
}

function fusionSwitchBrowse(view) {
  const fromPeriod = ["period-overview", "period-detail"].includes(state.page);
  if (view === "overview") {
    if (fromPeriod) {
      Object.assign(fusion, { regions: [...periodView.regions], topic: periodView.topic });
      Object.assign(state, { category: periodView.category, role: periodView.role, signalType: periodView.signalType, relevance: periodView.relevance, searchQuery: periodView.query, company: periodView.company === "all" ? "all" : boardCompany(periodView.company)?.display_name || "all" });
      els.searchInput.value = state.searchQuery;
      els.companyFilter.value = state.company;
      els.signalTypeFilter.value = state.signalType;
      els.relevanceFilter.value = state.relevance;
    }
    return fusionHome();
  }
  if (!fromPeriod) {
    const company = state.payload.companies.find(row => row.display_name === state.company || row.id === state.company);
    Object.assign(periodView, { regions: [...fusion.regions], topic: fusion.topic, category: state.category, role: state.role, signalType: state.signalType, relevance: state.relevance, company: company?.id || "all", query: state.searchQuery });
  }
  if (view === "records") {
    periodView.level = "records";
    periodView.scroll = 0;
    return openBoardRoute({ type: "list", value: "all", history: true });
  }
  return openPeriodBoard(view, { preserveAnchor: fromPeriod && periodView.level === "period" });
}

function initFusion() {
  els.regionFilter.innerHTML = '<option value="all">全部地区</option>' + regionDefinitions.map(region => `<option value="${region.id}">${escapeHtml(region.label)}</option>`).join("");
  document.querySelector("#fusionCategory").innerHTML = els.categoryFilter.innerHTML;
  document.querySelector("#fusionCategory").addEventListener("change", event => { state.category = event.target.value; els.categoryFilter.value = state.category; renderOverviewScope(); });
  document.querySelector("#fusionProduct").addEventListener("change", event => { fusion.topic = event.target.value; renderOverviewScope(); });
  document.querySelector("#browseNavigation").addEventListener("click", event => {
    const button = event.target.closest("[data-browse]");
    if (button) fusionSwitchBrowse(button.dataset.browse);
  });
  document.querySelector("#fusionRegionOptions").innerHTML = fusionRegionOptions("fusion");
  document.querySelector("#fusionRegionOptions").addEventListener("change", event => {
    fusionToggleRegionFamily("fusion", event.target);
    fusion.regions = [...document.querySelectorAll("[data-fusion-region]:checked")].map(input => input.value);
    state.region = "all"; renderOverviewScope();
  });
  document.querySelector("#fusionRegionMode").addEventListener("change", event => {
    fusion.regionMode = event.target.value;
    periodView.payload = null;
    renderOverviewScope();
    renderMethodology();
  });
  document.querySelector("#boardRegionMode").addEventListener("change", event => {
    fusion.regionMode = event.target.value;
    periodView.payload = null;
    renderPeriodOverview();
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-fusion-back], [data-fusion-region-family], [data-fusion-region-group], [data-fusion-region-rules], [data-fusion-region-reason], [data-fusion-region-review], [data-fusion-regions-all], [data-fusion-regions-clear], [data-fusion-region-detail], [data-fusion-category], [data-fusion-role], [data-fusion-topic], [data-fusion-item], [data-fusion-account], [data-fusion-profile], [data-fusion-all], [data-fusion-unknown-dates], [data-fusion-company-pool], [data-fusion-directory-all], [data-fusion-directory-account], [data-fusion-pool-news], [data-fusion-account-news]");
    if (!button) return;
    if (button.hasAttribute("data-fusion-region-rules")) return openFusionRegionRules();
    if (button.dataset.fusionRegionFamily) {
      const family = window.AIHOT_REGION_MODEL.distribution(getFilteredItems(), fusion.regionMode).find(row => row.id === button.dataset.fusionRegionFamily);
      return openFusionEvidence(`${family.label} / 全部下属地区`, family.items, { order: "date" });
    }
    if (button.dataset.fusionRegionGroup) {
      const group = button.dataset.fusionRegionGroup;
      return openFusionEvidence(`地区构成 / ${fusionRegionGroupLabels[group]}`, window.AIHOT_REGION_MODEL.partition(getFilteredItems(true), fusion.regionMode)[group], { order: "date", parentRules: state.page === "methodology" });
    }
    if (button.dataset.fusionRegionReview) {
      const status = button.dataset.fusionRegionReview;
      return openFusionEvidence(`AI 地区判读 / ${fusionReviewLabels[status]}`, getFilteredItems(true).filter(item => window.AIHOT_REGION_MODEL.reviewFor(item)?.status === status), { parentRules: true, order: "date" });
    }
    if (button.dataset.fusionRegionReason) {
      const model = window.AIHOT_REGION_MODEL;
      const reason = model.reasons.find(row => row.id === button.dataset.fusionRegionReason);
      return openFusionEvidence(`地区待确认 / ${reason.label}`, getFilteredItems(true).filter(item => model.analyze(item, fusion.regionMode).reason === reason.id), { parentRules: state.page === "methodology", order: "date" });
    }
    if (button.hasAttribute("data-fusion-back")) return fusionHome();
    if (button.hasAttribute("data-fusion-regions-all") || button.hasAttribute("data-fusion-regions-clear")) { fusion.regions = button.hasAttribute("data-fusion-regions-all") ? regionDefinitions.map(region => region.id) : []; state.region = "all"; renderOverviewScope(); return; }
    if (button.hasAttribute("data-fusion-directory-all")) { fusion.directoryScope = null; renderJapanAccountIntelligence(); renderCompanyPools(); return; }
    if (button.hasAttribute("data-fusion-company-pool")) return fusionOpenDirectory("companies");
    if (button.dataset.fusionDirectoryAccount) return fusionOpenDirectory("japan-customers", button.dataset.fusionDirectoryAccount);
    if (button.dataset.fusionPoolNews || button.dataset.fusionAccountNews) {
      const matches = button.dataset.fusionPoolNews ? fusionCompanyItems(button.dataset.fusionPoolNews) : fusionScopedAccountIndex().get(button.dataset.fusionAccountNews) || [];
      return openFusionEvidence("公司 / 关联新闻", matches, { order: "date", scope: fusion.directoryScope?.label || "全库已采集新闻" });
    }
    const items = getFilteredItems();
    if (button.hasAttribute("data-fusion-all")) openFusionEvidence("本期全部新闻", items);
    if (button.hasAttribute("data-fusion-unknown-dates")) openFusionEvidence("发布日期待核对", getFilteredItems(true, "unknown"), { unknown: true, order: "date" });
    if (button.dataset.fusionTopic) openFusionEvidence(`${boardTopicLabel(button.dataset.fusionTopic)} · 产品技术主题`, items.filter(item => fusionTopics(item).includes(button.dataset.fusionTopic)));
    if (button.dataset.fusionItem) openFusionEvidence("事件与公开证据", items.filter(item => item.id === button.dataset.fusionItem), { order: "date" });
    if (button.dataset.fusionAccount || button.dataset.fusionProfile) {
      const row = fusionAccountRows(items).find(row => row.key === (button.dataset.fusionAccount || button.dataset.fusionProfile));
      if (row) openFusionEvidence(`客户动态 / ${row.name}`, row.items, { order: "date", profile: { accountId: row.account?.id, organization: row.account?.organization_label } });
    }
    if (button.dataset.fusionRegionDetail) openFusionEvidence(`${labelRegion(button.dataset.fusionRegionDetail)} · 地区证据`, items.filter(item => fusionRegions(item).includes(button.dataset.fusionRegionDetail)));
    if (button.dataset.fusionCategory) openFusionEvidence(labelBusinessEvent(button.dataset.fusionCategory), items.filter(item => getBusinessEventType(item) === button.dataset.fusionCategory));
    if (button.dataset.fusionRole) openFusionEvidence(`${labelRole(button.dataset.fusionRole)} · 走势证据`, items.filter(item => getItemRole(item) === button.dataset.fusionRole));
  });
  window.addEventListener("popstate", event => {
    if (location.hash === "#fusion-evidence" && event.state?.fusionDetail) {
      fusion.detail = event.state.fusionDetail; state.page = "fusion-evidence"; renderFusionEvidence(); renderPage();
    }
  });
}
