const productModel = window.AIHOT_PRODUCT_MODEL;
const productLabel = id => productModel.definitions.find(row => row.id === id)?.label || "产品未识别";
const productAnalysis = item => productModel.analyze(item, state.payload?.companies || []);
const productMatches = (item, scope) => productModel.matches(productAnalysis(item), scope.products, scope.productDirection);

function productFilterOptions() {
  return [...productModel.definitions, { id: "unidentified", label: "产品未识别" }]
    .map(row => `<label><input type="checkbox" data-product-filter value="${row.id}" />${escapeHtml(row.label)}</label>`).join("");
}

function syncProductControls(prefix, scope) {
  const host = document.getElementById(`${prefix}ProductCategories`);
  if (!host.querySelector("input")) host.querySelector(".product-filter-options").innerHTML = productFilterOptions();
  host.querySelectorAll("input").forEach(input => { input.checked = scope.products.includes(input.value); });
  host.querySelector("summary span").textContent = scope.products.length ? scope.products.map(productLabel).join(" / ") : "全部产品";
  const direction = document.getElementById(`${prefix}ProductDirection`);
  if (!direction.options.length) direction.innerHTML = '<option value="all">全部观察方向</option>' + Object.entries(productModel.directions).map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  direction.value = scope.productDirection;
}

function productScopeText(scope) {
  return [...(scope.products || []).map(productLabel), ...(scope.productDirection && scope.productDirection !== "all" ? [productModel.directions[scope.productDirection]] : [])].join(" / ");
}

function productEvidenceMarkup(item) {
  const result = productAnalysis(item);
  if (!result.matches.length) return '<span class="product-unknown">产品未识别</span>';
  return `<details class="product-evidence"><summary>${result.matches.map(row => escapeHtml(row.label)).join(" · ")}<small>产品分类依据</small></summary><div>${result.matches.map(row => `<p><b>${escapeHtml(row.label)}</b> · ${row.directions.map(id => escapeHtml(productModel.directions[id])).join(" / ")}<br>${escapeHtml(row.terms.join("、"))}</p>${row.evidence.filter((hit, index, list) => list.findIndex(other => other.field === hit.field && other.quote === hit.quote) === index).map(hit => `<blockquote>${escapeHtml(hit.quote)}<small>${{ title: "原标题", summary: "来源摘要", source_excerpt: "来源摘录" }[hit.field]}</small></blockquote>`).join("")}`).join("")}<small>观察方向不是公司身份或采购关系。分类版本 ${result.version}</small></div></details>`;
}

function productEvents(items, context = "fusion") {
  return context === "board"
    ? periodModel.buildEvents(items, { companies: state.payload.companies, classify: getBusinessEventType, regions: fusionRegions })
    : fusionTopicEvents(items);
}

function productRowsMarkup(items, context = "fusion") {
  const scope = context === "board" ? periodView : fusion;
  items = fusionUniqueItems(items).filter(item => productMatches(item, scope));
  const eventsFor = matches => productEvents(matches, context);
  const totalEvents = eventsFor(items);
  const rows = productModel.definitions.map(definition => {
    const matches = items.filter(item => productModel.matches(productAnalysis(item), [definition.id], scope.productDirection));
    const events = eventsFor(matches);
    const companyCount = new Set(events.flatMap(event => event.companyIds)).size;
    const byDirection = Object.entries(productModel.directions).map(([id, label]) => {
      const subset = matches.filter(item => productModel.matches(productAnalysis(item), [definition.id], id));
      return `<button type="button" data-product-open="${definition.id}" data-product-context="${context}" data-product-direction="${id}">${label} <b>${eventsFor(subset).length}</b></button>`;
    }).join("");
    return `<div class="product-category-row" data-product-row="${definition.id}"><button type="button" class="product-category-main" data-product-open="${definition.id}" data-product-context="${context}"><span><strong>${definition.label}</strong><small>${definition.note}</small></span><span><b data-product-event-count>${events.length}</b> 个事件<small>${matches.length} 篇报道 · ${companyCount} 家公司</small></span><span aria-hidden="true">→</span></button><div class="product-directions">${byDirection}</div></div>`;
  }).join("");
  const unknown = items.filter(item => !productAnalysis(item).matches.length);
  return `<p class="product-stat-scope">${context === "board" ? boardFilterSummary() : `${fusionRangeLabel()} · ${getOverviewScopeLabel()}`} · ${totalEvents.length} 个事件 / ${items.length} 篇报道</p>${rows}<button type="button" class="text-button product-unknown-link" data-product-open="unidentified" data-product-context="${context}">产品未识别 · ${eventsFor(unknown).length} 个事件 / ${unknown.length} 篇报道 →</button><p class="product-stat-note">同一事件可涉及多个产品或观察方向，分类之和可能超过总数。按当前范围去重，观察方向不代表已成交客户。</p>`;
}

function renderProductRows(items) {
  document.getElementById("fusionProductRows").innerHTML = productRowsMarkup(items);
}

function productProfileMarkup(items, context = "fusion") {
  const events = productEvents(items, context);
  const rows = productModel.definitions.map(def => ({ ...def, count: events.filter(event => event.reports.some(item => productAnalysis(item).categories.includes(def.id))).length })).filter(row => row.count);
  return `<div class="living-profile-block product-profile"><span>产品分类 · 当前档案范围</span><div class="living-topic-list">${rows.map(row => `<span>${row.label} <b>${row.count}</b></span>`).join("") || "<small>产品未识别</small>"}</div><small>按去重事件统计，产品可多标签；不改变原有技术主题。</small></div>`;
}

function renderProductRules() {
  const host = document.getElementById("productRulesContent");
  if (!host) return;
  host.innerHTML = `<p>运行版本 ${productModel.version} · 前端按当前记录实时分类，不修改采集、准入或评分。</p><p>依据《ACRO产品与技术分类确认表-kaidi update》“产品分类确认”及补充说明。仅使用原标题、来源摘要和来源摘录，不使用公司介绍、AI建议或来源所在地作为产品证据；未命中保留“产品未识别”。</p><p>客户研发方向须命中现有客户／监测账户且有治疗研发、生产设施或AI辅助蛋白开发语境；竞品产品方向须命中现有竞品且有产品供应或服务语境。混合公司报道还要求该句出现对应公司名称。无法明确的命中保留“观察方向未明确”；本公司不自动变为竞品。</p><p>产品多选取并集，与观察方向、时间、公司、商业事件、地区、ACRO相关性及原有技术主题取交集。产品和观察方向须由同一个分类命中支持。</p>${productModel.definitions.map(row => `<section class="product-rule-row"><h4>${row.label}</h4><p>${row.note}</p><p><b>标准识别词：</b>${productModel.terms[row.id].map(term => escapeHtml(term.label)).join("、")}</p><details><summary>查看执行中的别名表达式</summary>${productModel.terms[row.id].map(term => `<p>${escapeHtml(term.label)} <code>${escapeHtml(term.pattern.source)}</code></p>`).join("")}</details>${row.removed.length ? `<p><b>不再独立触发：</b>${row.removed.join("、")}</p>` : ""}<small>业务表第 ${row.row} 行</small></section>`).join("")}<p>已取消“核酸与分子试剂”“酶”独立产品入口；历史记录与原有技术标签均保留。产品范围词须有对应产品、治疗或服务语境；PCR不匹配qPCR，检测方法本身不作为试剂盒。</p><h4>保留意见与待确认项</h4><ul>${productModel.pending.map(note => `<li>${note}</li>`).join("")}</ul>`;
  const boundary = document.createElement("p");
  boundary.textContent = "同一句同时出现客户和竞品、无法明确动作归属时，不自动把该产品判为双方向；保留观察方向未明确。分句有明确公司和活动依据时，才分别累计对应方向。";
  host.children[2].after(boundary);
}

function initProductUI() {
  for (const [prefix, scope] of [["fusion", fusion], ["board", periodView]]) {
    const host = document.getElementById(`${prefix}ProductCategories`);
    host.addEventListener("change", () => {
      scope.products = [...host.querySelectorAll("input:checked")].map(input => input.value);
      if (prefix === "fusion") renderOverviewScope();
      else { renderPeriodOverview(); writeBoardUrl(); }
    });
    document.getElementById(`${prefix}ProductDirection`).addEventListener("change", event => {
      scope.productDirection = event.target.value;
      if (prefix === "fusion") renderOverviewScope();
      else { renderPeriodOverview(); writeBoardUrl(); }
    });
    host.querySelector("[data-product-clear]").addEventListener("click", () => {
      scope.products = []; scope.productDirection = "all";
      if (prefix === "fusion") renderOverviewScope();
      else { renderPeriodOverview(); writeBoardUrl(); }
    });
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-product-open]");
    if (!button) return;
    const category = button.dataset.productOpen;
    const board = button.dataset.productContext === "board";
    const scope = board ? periodView : fusion;
    const direction = button.dataset.productDirection || scope.productDirection;
    if (board) return openBoardRoute({ type: "list", value: "product-classification", product: category, productDirection: direction, parent: periodView.route });
    const items = getFilteredItems().filter(item => productModel.matches(productAnalysis(item), [category], direction));
    openFusionEvidence(`${productLabel(category)}${direction !== "all" ? ` / ${productModel.directions[direction]}` : ""}`, items, { order: "date", kind: "product", product: category });
  });
}
