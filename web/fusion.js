const fusion = { regions: [], products: [], productDirection: "all", topic: "all", regionMode: "reviewed", detail: null, homeScroll: 0, directoryScope: null };
const fusionIsHomeContext = () => ["overview", "overview-metric", "fusion-evidence"].includes(state.page);
let fusionDashboardCache = { payload: null, archive: null, items: [] };

function fusionDashboardItems() {
  const archive = state.eventArchive || window.AIHOT_EVENT_ARCHIVE || {};
  if (fusionDashboardCache.payload === state.payload && fusionDashboardCache.archive === archive) {
    return fusionDashboardCache.items;
  }
  const retained = Array.isArray(archive.items) ? archive.items : [];
  const current = Array.isArray(state.payload?.items) ? state.payload.items : [];
  fusionDashboardCache = {
    payload: state.payload,
    archive,
    // A current record is the latest classification for a duplicated id.
    items: fusionUniqueItems([...retained, ...current]),
  };
  return fusionDashboardCache.items;
}

function fusionRegionEvidence(item) {
  return window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode).evidence;
}

function fusionRegions(item) {
  return window.AIHOT_REGION_MODEL.analyze(item, fusion.regionMode).regions;
}

const fusionReviewLabels = { identified: "有地区依据", nonregional: "内容未限定地区", pending: "已判读，地区证据不足" };
const fusionRegionGroupLabels = { located: "有地区依据", reviewed: "已逐条判读", unreviewed: "尚未逐条判读", inactive: "已存判读未启用" };

function fusionSemanticReviewMarkup(review) {
  const hits = window.AIHOT_REGION_MODEL.evidenceForReview(review);
  const accepted = [...new Set(hits.filter(hit => hit.accepted).map(hit => hit.region))];
  return `<div class="fusion-semantic-review"><p><b>原文判读记录</b> · ${escapeHtml(review.checkedAt)}</p><p>当前业务分类：${accepted.length ? accepted.map(labelRegion).map(escapeHtml).join(" / ") : "地区待确认"}。旧判读标签不作为国家证据。</p><p><b>核对范围：</b>${escapeHtml(review.scope)}</p>${review.evidence.map(source => `<p>${escapeHtml(source.kind)} · ${source.material === "snapshot" ? "标题 / 摘录，未读全文" : "已保存的来源引用"}<br>“${escapeHtml(source.quote || "")}”<br><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">查看来源证据 ↗</a></p>`).join("")}</div>`;
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
  syncProductControls("fusion", fusion);
  els.roleControl.querySelectorAll("[data-role-filter]").forEach(button => {
    const active = button.dataset.roleFilter === state.role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelector("#fusionRegionLabel").textContent = fusionRegionSelectionLabel(fusion.regions);
  document.querySelector("#fusionRegionMode").value = fusion.regionMode;
  document.querySelector("#fusionCategory").innerHTML = els.categoryFilter.innerHTML;
  document.querySelector("#fusionCategory").value = state.category;
  const topics = [...new Set(fusionDashboardItems().flatMap(fusionTopics))].sort((a, b) => Number(a === "unidentified") - Number(b === "unidentified") || a.localeCompare(b));
  document.querySelector("#fusionProduct").innerHTML = '<option value="all">全部技术 / 研究主题</option>' + topics.map(topic => `<option value="${escapeAttr(topic)}">${escapeHtml(boardTopicLabel(topic))}</option>`).join("");
  document.querySelector("#fusionProduct").value = fusion.topic;
  document.querySelectorAll("[data-fusion-region]").forEach(input => { input.checked = fusion.regions.includes(input.value); });
  fusionSyncRegionFamily("fusion", fusion.regions);
  const scope = `${fusionRangeLabel()} · ${getOverviewScopeLabel()}`;
  document.querySelector("#fusionScope").textContent = `${scope} · ${items.length} 条情报记录`;
  document.querySelector("#fusionMatrixScope").textContent = `同当前筛选 · 核心竞品 · 一条可命中多家公司`;
  document.querySelector("#fusionTotals").innerHTML = `<button type="button" data-fusion-all>本期新闻 <strong>${items.length}</strong></button><span>${fusionCompanyIds(items).length} 家监测公司涉及本期新闻</span>`;
}

function fusionRegionSelectionLabel(selected) {
  return selected.length ? selected.map(labelRegion).join(" / ") : "总计";
}

function fusionRegionOptions(prefix) {
  return `<label class="region-filter-total"><input type="checkbox" data-${prefix}-region-total />总计</label>${window.AIHOT_REGION_MODEL.businessDefinitions.map(row => `<label><input type="checkbox" data-${prefix}-region value="${row.id}" />${escapeHtml(row.label)}</label>`).join("")}`;
}

function fusionSyncRegionFamily(prefix, selected) {
  const input = document.querySelector(`[data-${prefix}-region-total]`);
  if (input) input.checked = !selected.length;
}

function fusionToggleRegionFamily(prefix, target) {
  if (!target.hasAttribute(`data-${prefix}-region-total`)) return;
  document.querySelectorAll(`[data-${prefix}-region]`).forEach(input => { input.checked = false; });
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
  const task = /建议按|建议动作|应核对|优先跟进|必须联系|今天应|交给.{0,12}(?:销售|市场|团队)|销售话术|(?:对ACRO|ACRO|市场部).{0,30}(?:应|可据此|值得|适合|优先)|值得ACRO|适合用于.{0,12}(?:对标|话术|材料)|应持续(?:对比|跟踪)|Suggested action|must contact|sales team should|technical support should/i;
  if (!task.test(String(text))) return String(text).trim();
  return String(text).split(/(?<=[。！？])|(?<=[.!?])\s+/).filter(sentence => !task.test(sentence)).join(" ").trim();
}

function fusionTopics(item) {
  const values = periodModel.topics(item);
  return values.length ? values : ["unidentified"];
}

const fusionTopicFamilies = {
  product: "产品与试剂",
  modality: "治疗方式",
  target: "药物靶点",
  platform: "技术平台",
  manufacturing: "生产与质量",
  other: "其他产品技术",
};

const fusionTopicDefinitions = {
  "抗体": { family: "product", description: "抗体药物、科研试剂与检测平台", image: "antibody.jpg" },
  "重组蛋白": { family: "product", description: "重组蛋白原料、表达纯化与研发应用", image: "recombinant-protein.jpg" },
  "ELISA": { family: "platform", description: "免疫学定量检测试剂与分析方法", image: "assay.jpg" },
  "ADC": { family: "modality", description: "抗体偶联药物及其靶点、连接子与开发平台", image: "adc.jpg" },
  "CGT": { family: "modality", description: "细胞与基因治疗的研发、生产与产业化", image: "cell-gene.jpg" },
  "CAR-T": { family: "modality", description: "CAR-T 细胞治疗及其配套研发与制造", image: "car-t.jpg" },
  "CAR-NK": { family: "modality", description: "CAR-NK 细胞治疗及其配套研发与制造", image: "car-nk.jpg" },
  "TCR-T": { family: "modality", description: "TCR-T 细胞治疗、抗原识别与临床开发动态", image: "tcr-t.jpg" },
  "细胞治疗": { family: "modality", description: "治疗性细胞的研发、制备、质控与临床进展", image: "cell-therapy.jpg" },
  "基因治疗": { family: "modality", description: "基因递送、编辑与治疗产品的开发进展", image: "gene-therapy.jpg" },
  "干细胞": { family: "modality", description: "干细胞研发、分化、工程化与治疗应用", image: "stem-cell.jpg" },
  "小分子": { family: "modality", description: "小分子药物的发现、临床与产品进展", image: "small-molecule.jpg" },
  "多肽": { family: "modality", description: "多肽药物、放射性配体与相关研发平台", image: "peptide.jpg" },
  "mRNA": { family: "modality", description: "信使 RNA 药物、递送与生产技术", image: "mrna.jpg" },
  "核酸": { family: "modality", description: "核酸药物、原料、递送与分析技术", image: "nucleic-acid.jpg" },
  "疫苗": { family: "modality", description: "疫苗抗原、佐剂、递送与研发生产动态", image: "vaccine.jpg" },
  "CRISPR": { family: "platform", description: "基因编辑工具、平台与治疗应用", image: "crispr.jpg" },
  "iPSC": { family: "platform", description: "诱导多能干细胞、疾病模型与细胞来源平台", image: "ipsc.jpg" },
  "类器官": { family: "platform", description: "类器官模型、药物筛选与转化研究平台", image: "organoid.jpg" },
  "流式细胞术": { family: "platform", description: "细胞分析、分选及其配套仪器试剂", image: "flow-cytometry.jpg" },
  "单细胞": { family: "platform", description: "单细胞分析、测序与细胞表型研究", image: "single-cell.jpg" },
  "测序": { family: "platform", description: "核酸测序、数据分析与研发应用", image: "sequencing.jpg" },
  "质谱": { family: "platform", description: "质谱分析、蛋白质组学与药物表征", image: "mass-spectrometry.jpg" },
  "色谱": { family: "platform", description: "分离纯化、质量分析与工艺开发", image: "chromatography.jpg" },
  "GMP": { family: "manufacturing", description: "生产质量、合规、厂房与供应链建设", image: "gmp.jpg" },
  "生物工艺": { family: "manufacturing", description: "生物制造工艺、放大、纯化与生产平台", image: "bioprocess.jpg" },
  "细胞培养": { family: "manufacturing", description: "细胞培养基、培养工艺与生产应用", image: "cell-culture.jpg" },
  "HER2": { family: "target", description: "HER2 靶点的药物、检测与临床开发动态", image: "target.jpg" },
  "CD19": { family: "target", description: "CD19 B 细胞表面靶点的抗体与细胞治疗动态", image: "cd19.jpg" },
  "CD20": { family: "target", description: "B 细胞表面 CD20 靶点的抗体、双抗与检测产品动态", image: "cd20.jpg" },
  "BCMA": { family: "target", description: "BCMA 靶点的细胞治疗、抗体与临床开发动态", image: "bcma.jpg" },
  "CTLA-4": { family: "target", description: "CTLA-4 免疫检查点的抗体与联合治疗动态", image: "ctla4.jpg" },
  "B7-H3": { family: "target", description: "B7-H3 靶点的抗体、偶联药物与临床开发动态", image: "b7-h3.jpg" },
  "DLL3": { family: "target", description: "DLL3 靶点的偶联药物、双抗与临床开发动态", image: "dll3.jpg" },
  "EGFR": { family: "target", description: "EGFR 靶点的抗体、小分子与临床开发动态", image: "egfr.jpg" },
  "KRAS": { family: "target", description: "KRAS 靶点及其突变型抑制剂的研发动态", image: "kras.jpg" },
  "TROP2": { family: "target", description: "TROP2 靶点的偶联药物与临床开发动态", image: "trop2.jpg" },
};

function fusionTopicDefinition(topic) {
  if (fusionTopicDefinitions[topic]) return fusionTopicDefinitions[topic];
  if (/^(?:HER\d*|BCMA|CTLA-?4|PD-?[1L]|CD\d+|EGFR|KRAS|VEGF|TROP-?2)$/i.test(topic)) {
    return { family: "target", description: `${topic} 靶点的药物、检测与临床开发动态`, image: "target.jpg" };
  }
  return { family: "other", description: "该产品或技术主题下的已监测公开动态", image: "assay.jpg" };
}

function fusionTopicImageUrl(filename) {
  return window.AIHOT_TOPIC_IMAGES?.[filename] || `assets/topic-thumbnails/${filename}`;
}

function fusionReviewedEventKey(item) {
  const key = String(item.summary_review?.event_key || "").trim();
  return key && !/^(?:translation|legacy-editorial):/i.test(key) ? key : "";
}

function fusionTopicEvents(items) {
  const built = periodModel.buildEvents(fusionUniqueItems(items), {
    companies: state.payload.companies || [],
    classify: getBusinessEventType,
    regions: fusionRegions,
  });
  const merged = new Map();
  for (const event of built) {
    const reviewKeys = [...new Set(event.reports.map(fusionReviewedEventKey).filter(Boolean))];
    const key = reviewKeys.length === 1 ? `review:${reviewKeys[0]}` : `event:${event.id}`;
    if (!merged.has(key)) {
      merged.set(key, {
        ...event,
        reports: [...event.reports],
        companyIds: [...event.companyIds],
        topics: [...event.topics],
        regions: [...event.regions],
        categories: [...event.categories],
        evidence: [...event.evidence],
      });
      continue;
    }
    const target = merged.get(key);
    target.reports = fusionUniqueItems([...target.reports, ...event.reports]);
    target.companyIds = [...new Set([...target.companyIds, ...event.companyIds])];
    target.topics = [...new Set([...target.topics, ...event.topics])];
    target.regions = [...new Set([...target.regions, ...event.regions])];
    target.categories = [...new Set([...target.categories, ...event.categories])];
    target.evidence = [...new Map([...target.evidence, ...event.evidence].map(source => [source.url, source])).values()];
  }
  return [...merged.values()].map(event => {
    const recent = fusionRecent(event.reports);
    event.reports = [...recent].sort((a, b) => Number(b.summary_method === "manual_ai") - Number(a.summary_method === "manual_ai") || String(b.published_at || b.published || "").localeCompare(String(a.published_at || a.published || "")));
    event.item = event.reports[0];
    event.published = periodModel.publicationDate(recent[0]) || "";
    event.category = event.categories[0];
    return event;
  }).sort(periodModel.compareRecent);
}

function fusionTopicCompanies(events) {
  const counts = new Map();
  for (const event of events) for (const id of new Set(event.companyIds)) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts].map(([id, count]) => ({ company: boardCompany(id), count })).filter(row => row.company)
    .sort((a, b) => b.count - a.count || compactCompanyName(a.company).localeCompare(compactCompanyName(b.company)));
}

function fusionTopicItems(items, topic) {
  if (topic !== "unidentified") return items.filter(item => fusionTopics(item).includes(topic));
  return fusionUniqueItems(fusionTopicEvents(items).filter(event => event.topics.every(value => value === "unidentified")).flatMap(event => event.reports));
}

function fusionTopicRowMarkup(entry, maxCount) {
  const { topic, events } = entry;
  const definition = fusionTopicDefinition(topic);
  const companies = fusionTopicCompanies(events);
  const latest = events[0];
  const latestTitle = latest ? getDisplayTitle(latest.item) : "暂无代表事件";
  const latestDate = latest?.published || "日期待核对";
  const reports = fusionUniqueItems(events.flatMap(event => event.reports)).length;
  const width = Math.max(6, Math.round(events.length / Math.max(1, maxCount) * 100));
  const companyMarkup = companies.length
    ? companies.slice(0, 3).map(row => `<span class="fusion-topic-company-logo" title="${escapeAttr(compactCompanyName(row.company))} · ${row.count} 个事件">${companyLogoMarkup(row.company)}</span>`).join("")
    : '<span class="fusion-topic-no-company">公司待识别</span>';
  return `<button type="button" class="fusion-topic-row" data-fusion-topic="${escapeAttr(topic)}" style="--topic-share:${width}%">
    <img class="fusion-topic-thumbnail" src="${escapeAttr(fusionTopicImageUrl(definition.image))}" alt="${escapeAttr(boardTopicLabel(topic))}主题示意图" loading="lazy" decoding="async" />
    <span class="fusion-topic-copy"><span class="fusion-topic-family">${escapeHtml(fusionTopicFamilies[definition.family])}</span><strong>${escapeHtml(boardTopicLabel(topic))}</strong><small>${escapeHtml(definition.description)}</small><span class="fusion-topic-latest">近期事件 · ${escapeHtml(latestDate)} · ${escapeHtml(latestTitle)}</span></span>
    <span class="fusion-topic-volume"><strong>${events.length}</strong><small>去重事件</small><i aria-hidden="true"><b></b></i><em>${reports} 篇报道</em></span>
    <span class="fusion-topic-companies"><span>${companyMarkup}</span><small>${companies.length} 家公司</small></span>
    <span class="fusion-topic-open" aria-hidden="true">→</span>
  </button>`;
}

function renderFusionTopics(items) {
  renderProductRows(items);
  const buckets = new Map();
  for (const item of items) for (const topic of fusionTopics(item)) {
    if (!buckets.has(topic)) buckets.set(topic, []);
    buckets.get(topic).push(item);
  }
  const allEvents = fusionTopicEvents(items);
  const entries = [...buckets].filter(([topic]) => topic !== "unidentified").map(([topic, matches]) => ({ topic, matches, events: fusionTopicEvents(matches) }))
    .sort((a, b) => b.events.length - a.events.length || a.topic.localeCompare(b.topic));
  const identifiedEvents = allEvents.filter(event => event.topics.some(topic => topic !== "unidentified"));
  const unknownEvents = fusionTopicEvents(fusionTopicItems(items, "unidentified"));
  document.querySelector("#fusionTopicScope").textContent = `${identifiedEvents.length} / ${allEvents.length} 个去重事件已识别主题 · ${items.length} 篇报道`;
  if (!entries.length && !unknownEvents.length) {
    document.querySelector("#fusionTopicRows").innerHTML = '<p class="empty">当前范围没有产品或技术事件。</p>';
    return;
  }
  const maxCount = Math.max(1, ...entries.map(entry => entry.events.length));
  const rows = entries.map(entry => fusionTopicRowMarkup(entry, maxCount)).join("");
  const unknown = unknownEvents.length ? `<button type="button" class="fusion-topic-audit" data-fusion-topic="unidentified"><span><b>待补产品 / 技术标签</b><small>暂未在标题、摘要或结构化字段中命中主题，不代表该事件没有技术内容。</small></span><strong>${unknownEvents.length} 个去重事件</strong><i>查看待补记录 →</i></button>` : "";
  document.querySelector("#fusionTopicRows").innerHTML = `<div class="fusion-topic-featured">${rows}</div>${unknown}`;
}

function fusionAccountRows(items) {
  const index = fusionScopedAccountIndex(items);
  const priorities = new Map(buildCustomerAccountPriorities(state.timeRange, items).map(row => [row.company.id, row]));
  const companies = (state.payload.companies || []).filter(company => company.business_role === "customer");
  const rows = (getJapanAccountData().accounts || []).map(account => {
    const company = companies.find(company => findAccountForCompany(company)?.id === account.id);
    const matches = index.get(account.id) || [];
    const priority = priorities.get(company?.id) || calculateCustomerAccountPriority(company, matches, account);
    return { key: account.id, name: account.name, account, company, identity: accountCompanyIdentity(account, company), items: matches, priority };
  });
  for (const company of companies.filter(company => !rows.some(row => row.company?.id === company.id))) {
    const matches = items.filter(item => (item.matched_company_ids || []).includes(company.id));
    const priority = priorities.get(company.id) || calculateCustomerAccountPriority(company, matches);
    rows.push({ key: company.id, name: company.display_name, company, identity: company, items: matches, priority });
  }
  return rows.filter(row => row.items.length).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

function renderFusionCustomers(items) {
  const rows = fusionAccountRows(items);
  const accountTotal = (getJapanAccountData().accounts || []).length;
  const newsTotal = fusionUniqueItems(rows.flatMap(row => row.items)).length;
  const hiddenTotal = Math.max(0, accountTotal - rows.filter(row => row.account).length);
  els.customerPriorityScope.innerHTML = `<b>${rows.length}</b> 家本期有动态 · <b>${accountTotal}</b> 家账户总库 · <b>${newsTotal}</b> 条公开信息`;
  els.customerPriorityMatrix.innerHTML = rows.length ? rows.map(row => {
    const latest = fusionRecent(row.items)[0];
    const priority = row.priority;
    return `<article class="fusion-customer-row" data-fusion-account-row="${escapeAttr(row.key)}">
      <header class="fusion-customer-card-head"><strong class="company-name-with-logo">${companyLogoMarkup(row.identity)}${companyNameMarkup(row.identity)}</strong><span>监测账户</span></header>
      <div class="fusion-customer-latest"><span>最新公开事件</span>
        <button type="button" class="fusion-event-link" data-fusion-item="${escapeAttr(latest.id)}">${escapeHtml(getDisplayTitle(latest))}</button>
        <small>${escapeHtml(fusionDateLabel(latest))} · ${escapeHtml(getSourceLabelText(latest))}</small></div>
      <div class="fusion-customer-card-metrics">
        <button type="button" class="customer-priority-count" data-fusion-account="${escapeAttr(row.key)}"><span>当前新闻</span><strong>${row.items.length}</strong><small>查看公开证据</small></button>
        <div><span>ACRO 关注内容占比 <button class="metric-label-help" type="button" data-methodology-target="relevance-density" aria-label="查看 ACRO 关注内容占比规则">i</button></span><strong class="customer-priority-density">${priority.density}%</strong><small>内容匹配，不是客户关系</small></div>
        <div><span>公开信号参考指数 <button class="metric-label-help" type="button" data-methodology-target="priority-index" aria-label="查看公开信号参考指数规则">i</button></span><strong class="fusion-reference-score"><button type="button" class="text-button" data-methodology-target="priority-index" aria-label="公开信号参考指数 ${priority.priorityScore}，查看计算规则">${priority.priorityScore}</button><small>/ 99</small></strong><small>用于同范围内横向比较</small></div>
      </div>
      <footer><span>${row.account?.organization_label ? escapeHtml(row.account.organization_label) : "公开动态监测对象"}</span><button type="button" class="text-button" data-fusion-profile="${escapeAttr(row.key)}">查看公司详情 →</button></footer>
    </article>`;
  }).join("") : '<div class="empty">当前范围没有监测账户的公开新闻，不代表目录已删除或市场没有活动。</div>';
  const methodNote = document.querySelector("#customerPriorityMethodNote");
  if (methodNote) methodNote.textContent = `当前只展示本期有公开信息的账户；另有 ${hiddenTotal} 家仍保留在账户目录。ACRO 关注内容占比是该账户新闻中高相关与中相关内容的加权占比，不是 ACRO 与该公司的关系强度；公开信号参考指数综合新闻量、时效、来源和事件多样性，仅供浏览比较。`;
}

function fusionAssistantResponse(intent, items) {
  const scope = intent === "account" ? fusionUniqueItems(fusionAccountRows(items).flatMap(row => row.items)) : intent === "competitor" ? items.filter(item => getItemRole(item) === "competitor") : items;
  const recent = fusionLatest(scope);
  return { headline: intent === "account" ? "客户动态：本期公开事件" : intent === "competitor" ? "竞品动态：本期公开事件" : "本期市场信息与证据", actions: recent.map(item => ({ label: labelBusinessEvent(getBusinessEventType(item)), title: getDisplayTitle(item), detail: `${fusionDateLabel(item)} · ${getSourceLabelText(item)}`, company: "", category: "", evidenceIds: [item.id] })) };
}

function fusionDirectoryItems() {
  const items = fusionDashboardItems();
  if (!fusion.directoryScope) return items;
  const ids = new Set(fusion.directoryScope.ids);
  return items.filter(item => ids.has(item.id));
}

function fusionScopedAccountIndex(items = fusionDirectoryItems()) {
  const allowed = new Set(items.map(item => item.id));
  const index = new Map([...getJapanAccountSignalIndex(items)].map(([id, matches]) => [id, fusionUniqueItems(matches.filter(item => allowed.has(item.id)))]));
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
  const unique = fusionUniqueItems(items);
  const rows = [{ id: "all", label: "总计", items: unique }, ...model.distribution(unique, fusion.regionMode)];
  const unknown = model.partition(unique, fusion.regionMode).pending.length;
  const max = Math.max(1, unique.length);
  els.regionBars.innerHTML = `<p class="fusion-region-coverage" data-region-total="${unique.length}" data-region-unknown="${unknown}">${escapeHtml(fusionRangeLabel())} · ${escapeHtml(fusionRegionSelectionLabel(fusion.regions))} · <b>${unique.length}</b> 条新闻</p>
    <div class="region-chart-axis"><span>地区</span><span>新闻数量</span></div>
    <div class="fusion-geography-bars">${rows.map(row => `<button class="region-row fusion-chart-row${row.id === "all" ? " region-total-row" : ""}" type="button" data-fusion-region-detail="${row.id}" aria-label="${row.label}：${row.items.length} 条新闻，查看明细"><div><span>${row.label}</span><strong>${row.items.length}</strong></div><div class="region-track"><i style="width:${row.items.length / max * 100}%"></i></div></button>`).join("")}</div>
    <small class="fusion-region-footnote">多地区新闻分别计入，分类之和可能超过总计。总计保留国家未明确的新闻（当前 ${unknown} 条）。</small>`;
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
  const groups = model.partition(items, fusion.regionMode);
  document.querySelector("#regionRulesContent").innerHTML = `<div class="fusion-region-rules"><header><p class="eyebrow">地区规则 ${model.version}</p><h2>地区判读与统计</h2><p>${escapeHtml(fusionRangeLabel())} · ${escapeHtml(getOverviewScopeLabel())} · ${items.length} 条新闻</p></header>
    <section><h3>01 · 固定业务分类</h3><p>总计、日本、韩国、印度、新加坡、澳大利亚、其他国家。总计不是国家标签，而是当前全部筛选条件下的新闻数，包含国家尚未明确的记录。</p><div class="fusion-region-taxonomy">${model.businessDefinitions.map(row => `<div><strong>${row.label}</strong><span>${row.scope}</span></div>`).join("")}</div><p>其他国家覆盖现有 ACRO 国家清单：阿富汗、阿尔及利亚、澳属萨摩亚、安哥拉、亚美尼亚、阿塞拜疆、巴林、孟加拉国、不丹、文莱、柬埔寨、喀麦隆、埃及、斐济、法属波利尼西亚、关岛、印度尼西亚、伊朗、伊拉克、以色列、约旦、哈萨克斯坦、科威特、吉尔吉斯斯坦、老挝、黎巴嫩、马来西亚、马尔代夫、蒙古、缅甸、尼泊尔、新喀里多尼亚、新西兰、阿曼、巴基斯坦、巴勒斯坦、巴布亚新几内亚、菲律宾、卡塔尔、俄罗斯、沙特阿拉伯、所罗门群岛、斯里兰卡、叙利亚、塔吉克斯坦、泰国、东帝汶、汤加、土耳其、土库曼斯坦、阿联酋、乌兹别克斯坦、瓦努阿图等。也包括五个单列国家以外有明确证据的美国、中国、加拿大及欧洲各国；不是将未识别记录放入兜底分类。</p></section>
    <section><h3>02 · 原文证据准入</h3><p>只采用原标题、来源摘录和按记录 ID 与标题绑定的原文引用中的明确国家或可唯一归属的具体地点。地点可以是会议会址、试验地点或供应市场，不统一解释为事件发生地；计划仍是计划。只读到标题或摘录时，不声称全文精读。</p><p>公司所在地、公司名称、媒体名称、站点语言或域名、联系地址和新闻电头不能作为分类依据。AI 摘要、旧判读标签、通过机构所在地推断的结论不能单独作为国家证据。仅 FDA、EMA、PMDA、TGA 等机构缩写不自动补国家。只写全球、亚太、亚洲、欧洲、国内或海外且没有具体地点的记录保留内部“地区待确认”，不展开国家、不计入其他国家。</p><p>已保存的事件原文引用用于排除长摘录中的背景信息，旧大区标签不直接换算为国家。“仅标题 / 来源摘录”模式不使用保存的引用。中英日国家名称与明确地点别名按较长词优先匹配，避免将印度尼西亚误分为印度。</p></section>
    <section><h3>03 · 计数、筛选和跳转</h3><p>总览固定快照截至日近90天入选新闻，按记录 ID 去重。每篇可以命中多个地区，每类只计一次，分类合计可能大于总计。未明确国家的记录仍计入总计。点击地区保留当前筛选并进入对应新闻；点击总计查看当前筛选的全部新闻。</p><p>地区内多选取并集，与时间、公司、商业事件、产品技术、ACRO 相关性取交集。顶部总计、全选及清除选择均取消地区限制，包含待确认记录；手动勾选六类是六类的并集，不含待确认。顶部、构成图、客户、竞品、新闻及详情共用同一地区判读函数。周月页面保持原有事件合并口径，仅同步国家分类。</p></section>
    <section><h3>04 · 内部证据状态</h3><p>当前有明确国家证据 ${groups.located.length} 条，地区待确认 ${groups.pending.length} 条，两者相加等于总计 ${items.length} 条。旧 AI 判读是历史工作记录，不代表全部通过本版国家准入规则；本次未做新的全量原文复核。</p><div class="fusion-region-reasons">${fusionUnknownReasonRows(items) || "当前范围没有地区待确认记录。"}</div></section>
    <section><h3>05 · 已保存的原文核对</h3><p>保留原文核对记录，不修改公司身份、入选门槛或历史新闻。地区证据变化不代表新闻被删除。</p>${items.filter(item => model.reviewFor(item)).map(item => `<details class="fusion-review-entry"><summary>${escapeHtml(item.title_zh || item.title)} · ${model.analyze(item, fusion.regionMode).regions.map(labelRegion).join(" / ")}</summary>${fusionSemanticReviewMarkup(model.reviewFor(item))}</details>`).join("")}</section></div>`;
}

function openFusionEvidence(title, items, options = {}) {
  if (state.page !== "fusion-evidence") fusion.homeScroll = window.scrollY;
  fusion.detail = { title, ids: fusionUniqueItems(items).map(item => item.id), scope: options.scope || (options.unknown ? `发布日期待核对，未计入周期 · ${getOverviewScopeLabel()}` : `${fusionRangeLabel()} · ${getOverviewScopeLabel()}`), order: options.order || "score", profile: options.profile || null, parentRules: options.parentRules || false, kind: options.kind || "records", topic: options.topic || null };
  state.page = "fusion-evidence";
  history.pushState({ fusionDetail: fusion.detail }, "", "#fusion-evidence");
  renderFusionEvidence(); renderPage(); window.scrollTo(0, 0);
}

function renderFusionEvidence() {
  if (!fusion.detail) return;
  if (fusion.detail.kind === "region-rules") return renderFusionRegionRules();
  const ids = new Set(fusion.detail.ids);
  const matches = fusionDashboardItems().filter(item => ids.has(item.id));
  const items = fusion.detail.order === "date" ? fusionRecent(matches) : matches.sort((a, b) => b.score - a.score);
  const isTopic = ["topic", "product"].includes(fusion.detail.kind);
  const topicEvents = isTopic ? fusionTopicEvents(items) : [];
  const count = isTopic ? `${topicEvents.length} 个事件 · ${items.length} 篇报道${fusion.detail.kind === "product" ? ` · ${fusionTopicCompanies(topicEvents).length} 家公司` : ""}` : `${items.length} 条`;
  const topicNote = fusion.detail.kind === "topic" && fusion.detail.topic !== "unidentified" ? fusionTopicDefinition(fusion.detail.topic).description : "";
  const breadcrumb = isTopic ? `<span>${fusion.detail.kind === "product" ? "产品分类" : "产品 / 技术领域"}</span><i>/</i>` : "";
  document.querySelector("#fusionEvidence").innerHTML = `<div class="metric-detail-navigation"><button type="button" class="methodology-back-button" data-fusion-back>← 返回总看板</button><nav class="methodology-breadcrumb" aria-label="当前位置"><span>总看板</span><i>/</i>${breadcrumb}<strong>${escapeHtml(fusion.detail.title)}</strong></nav></div><header class="fusion-evidence-heading"><h2>${escapeHtml(fusion.detail.title)}</h2><strong>${escapeHtml(count)}</strong><p>${escapeHtml(topicNote || fusion.detail.scope)}</p>${topicNote ? `<p>${escapeHtml(fusion.detail.scope)} · 同一事件的多篇报道已合并，所有原文入口仍保留。</p>` : ""}</header><div class="${isTopic ? "fusion-topic-evidence-list" : "signal-list"}" id="fusionEvidenceCards"></div>`;
  if (isTopic) {
    document.querySelector("#fusionEvidenceCards").innerHTML = topicEvents.map(event => {
      const summary = fusionSummary(event.item);
      const companies = event.companyIds.map(boardCompany).filter(Boolean);
      const sourceLinks = event.evidence.map((source, index) => {
        const label = source.labels?.filter(Boolean).join(" + ") || `原文 ${index + 1}`;
        return `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
      }).join("");
      const companyNames = companies.map(compactCompanyName).join(" / ");
      return `<article class="fusion-topic-evidence-event">
        <header><div class="fusion-topic-evidence-companies"><span>${companies.slice(0, 4).map(company => companyLogoMarkup(company)).join("")}</span><small>${escapeHtml(companyNames || "相关公司待识别")}</small></div><div><span>${escapeHtml(labelBusinessEvent(event.category, true))}</span><h3>${escapeHtml(getDisplayTitle(event.item))}</h3></div><time>${escapeHtml(event.published ? `发布 ${event.published}` : "发布日期待核对")}</time></header>
        <p>${escapeHtml(summary.text)}</p>
        <div class="product-event-tags">${event.reports.map(productEvidenceMarkup).join("")}</div>
        <div class="fusion-topic-evidence-tags">${event.topics.filter(topic => topic !== "unidentified").map(topic => `<span>${escapeHtml(boardTopicLabel(topic))}</span>`).join("")}${event.regions.filter(region => !["unknown", "nonregional"].includes(region)).map(region => `<span>${escapeHtml(labelRegion(region))}</span>`).join("")}</div>
        <footer><span>${event.reports.length} 篇报道 · ${event.evidence.length} 个原文入口</span><div>${sourceLinks || "暂无可用原文链接"}</div></footer>
      </article>`;
    }).join("") || '<p class="empty">当前范围没有可展示的去重事件。</p>';
  } else {
    renderSignalCards(document.querySelector("#fusionEvidenceCards"), items, false);
  }
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
      Object.assign(fusion, { regions: [...periodView.regions], products: [...periodView.products], productDirection: periodView.productDirection, topic: periodView.topic });
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
    Object.assign(periodView, { regions: [...fusion.regions], products: [...fusion.products], productDirection: fusion.productDirection, topic: fusion.topic, category: state.category, role: state.role, signalType: state.signalType, relevance: state.relevance, company: company?.id || "all", query: state.searchQuery });
  }
  if (view === "records") {
    periodView.level = "records";
    periodView.scroll = 0;
    return openBoardRoute({ type: "list", value: "all", history: true });
  }
  return openPeriodBoard(view, { preserveAnchor: fromPeriod && periodView.level === "period" });
}

function initFusion() {
  initProductUI();
  els.regionFilter.innerHTML = '<option value="all">总计</option>' + window.AIHOT_REGION_MODEL.businessDefinitions.map(region => `<option value="${region.id}">${escapeHtml(region.label)}</option>`).join("");
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
    if (button.hasAttribute("data-fusion-regions-all") || button.hasAttribute("data-fusion-regions-clear")) { fusion.regions = []; state.region = "all"; renderOverviewScope(); return; }
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
    if (button.dataset.fusionTopic) openFusionEvidence(button.dataset.fusionTopic === "unidentified" ? "待补产品 / 技术标签" : `${boardTopicLabel(button.dataset.fusionTopic)} · 产品技术主题`, fusionTopicItems(items, button.dataset.fusionTopic), { order: "date", kind: "topic", topic: button.dataset.fusionTopic });
    if (button.dataset.fusionItem) openFusionEvidence("事件与公开证据", items.filter(item => item.id === button.dataset.fusionItem), { order: "date" });
    if (button.dataset.fusionAccount || button.dataset.fusionProfile) {
      const row = fusionAccountRows(items).find(row => row.key === (button.dataset.fusionAccount || button.dataset.fusionProfile));
      if (row) openFusionEvidence(`客户动态 / ${row.name}`, row.items, { order: "date", profile: { accountId: row.account?.id, organization: row.account?.organization_label } });
    }
    if (button.dataset.fusionRegionDetail) openFusionEvidence(`地区构成 / ${button.dataset.fusionRegionDetail === "all" ? "总计" : labelRegion(button.dataset.fusionRegionDetail)}`, button.dataset.fusionRegionDetail === "all" ? items : items.filter(item => fusionRegions(item).includes(button.dataset.fusionRegionDetail)), { order: "date" });
    if (button.dataset.fusionCategory) openFusionEvidence(labelBusinessEvent(button.dataset.fusionCategory), items.filter(item => getBusinessEventType(item) === button.dataset.fusionCategory));
    if (button.dataset.fusionRole) openFusionEvidence(`${labelRole(button.dataset.fusionRole)} · 走势证据`, items.filter(item => getItemRole(item) === button.dataset.fusionRole));
  });
  window.addEventListener("popstate", event => {
    if (location.hash === "#fusion-evidence" && event.state?.fusionDetail) {
      fusion.detail = event.state.fusionDetail; state.page = "fusion-evidence"; renderFusionEvidence(); renderPage();
    }
  });
}
