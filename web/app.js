const state = {
  payload: null,
  tier: "daily",
  company: "all",
  category: "all",
};

const fallbackPayload = {
  generated_at: new Date().toISOString(),
  window_days: 45,
  summary: {
    new_candidates: 43,
    immediate: 0,
    daily: 3,
    archive: 40,
    errors: 0,
    companies: 1,
    sources: 5,
  },
  category_mix: {
    partnership: 6,
    finance: 3,
    regulatory: 1,
    company: 33,
  },
  source_mix: {
    "Google News RSS - ACROBiosystems": 36,
    "ACROBiosystems official news": 5,
    "ACROBiosystems Japan official site": 2,
  },
  items: [
    {
      id: "sample-cgt",
      company: "ACROBiosystems / 百普赛斯",
      source_label: "Google News RSS - ACROBiosystems",
      source_trust: "aggregator",
      title: "Driving Innovation, Empowering Partners: ACROBiosystems Showcases Comprehensive CGT Solutions Anchored by GMP Capabilities at Bio Korea 2026",
      url: "#",
      published: "2026-06-01",
      summary: "ACRO 展示围绕 CGT 与 GMP 能力的综合解决方案，适合作为市场部观察亚太活动传播和产品线表达的样本。",
      score: 65,
      tier: "daily",
      category: "partnership",
      reasons: ["公司别名命中: ACROBiosystems", "战略主题命中: CGT, GMP", "业务动作命中: partner"],
      age_days: 35,
    },
    {
      id: "sample-ipo",
      company: "ACROBiosystems / 百普赛斯",
      source_label: "Google News RSS - ACROBiosystems",
      source_trust: "aggregator",
      title: "IPO News | ACROBiosystems Plans Hong Kong IPO",
      url: "#",
      published: "2026-05-29",
      summary: "资本市场信号不一定直接给市场部使用，但对老板视角的公司动态和品牌阶段判断有参考价值。",
      score: 45,
      tier: "daily",
      category: "regulatory",
      reasons: ["公司别名命中: ACROBiosystems"],
      age_days: 38,
    },
  ],
};

const els = {
  metricCandidates: document.querySelector("#metricCandidates"),
  metricDaily: document.querySelector("#metricDaily"),
  metricImmediate: document.querySelector("#metricImmediate"),
  metricArchive: document.querySelector("#metricArchive"),
  updatedAt: document.querySelector("#updatedAt"),
  signalList: document.querySelector("#signalList"),
  topicBars: document.querySelector("#topicBars"),
  sourceList: document.querySelector("#sourceList"),
  sourceCount: document.querySelector("#sourceCount"),
  windowDays: document.querySelector("#windowDays"),
  tierFilter: document.querySelector("#tierFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  companyFilter: document.querySelector("#companyFilter"),
  refreshButton: document.querySelector("#refreshButton"),
};

async function loadData() {
  try {
    let response = await fetch("../data/latest_run.json", { cache: "no-store" });
    if (!response.ok) {
      response = await fetch("./data/latest_run.json", { cache: "no-store" });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.payload = await response.json();
  } catch (error) {
    state.payload = fallbackPayload;
  }
  hydrateFilters();
  render();
}

function hydrateFilters() {
  const categories = [...new Set(state.payload.items.map((item) => item.category))].sort();
  const companies = [...new Set(state.payload.items.map((item) => item.company))].sort();
  const current = els.categoryFilter.value;
  const currentCompany = els.companyFilter.value;
  els.categoryFilter.innerHTML = '<option value="all">全部主题</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = labelCategory(category);
    els.categoryFilter.appendChild(option);
  }
  els.categoryFilter.value = categories.includes(current) ? current : "all";

  els.companyFilter.innerHTML = '<option value="all">全部公司</option>';
  for (const company of companies) {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    els.companyFilter.appendChild(option);
  }
  els.companyFilter.value = companies.includes(currentCompany) ? currentCompany : "all";
}

function render() {
  const { payload } = state;
  els.metricCandidates.textContent = payload.summary.new_candidates;
  els.metricDaily.textContent = payload.summary.daily;
  els.metricImmediate.textContent = payload.summary.immediate;
  els.metricArchive.textContent = payload.summary.archive;
  els.windowDays.textContent = `${payload.window_days} 天`;
  els.sourceCount.textContent = `${payload.summary.sources} sources`;
  els.updatedAt.textContent = `更新于 ${formatDateTime(payload.generated_at)}`;

  renderSignals();
  renderBars(els.topicBars, payload.category_mix, labelCategory);
  renderSources();
}

function renderSignals() {
  const filtered = state.payload.items
    .filter((item) => state.tier === "all" || item.tier === state.tier)
    .filter((item) => state.company === "all" || item.company === state.company)
    .filter((item) => state.category === "all" || item.category === state.category)
    .sort((a, b) => b.score - a.score);

  els.signalList.innerHTML = "";
  if (!filtered.length) {
    els.signalList.innerHTML = '<div class="empty">当前筛选条件下没有需要展示的信号。</div>';
    return;
  }

  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "signal-card";
    card.innerHTML = `
      <div class="signal-top">
        <a class="signal-title" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <span class="score">${item.score}</span>
      </div>
      <div class="meta-row">
        <span class="tag ${item.tier}">${labelTier(item.tier)}</span>
        <span class="tag">${labelCategory(item.category)}</span>
        <span class="tag">${escapeHtml(item.company)}</span>
        <span class="tag">${escapeHtml(item.published || "no date")}</span>
      </div>
      <p class="summary">${escapeHtml(item.summary || "暂无摘要，建议回原文核对。")}</p>
      <ul class="reason-list">
        ${item.reasons.slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
      </ul>
    `;
    els.signalList.appendChild(card);
  }
}

function renderBars(container, data, labeler) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  container.innerHTML = entries
    .map(([key, value]) => {
      const width = Math.max(8, Math.round((value / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label"><span>${escapeHtml(labeler(key))}</span><strong>${value}</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderSources() {
  const entries = Object.entries(state.payload.source_mix).sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.sourceList.innerHTML = entries
    .map(([name, count]) => `<div class="source-item"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`)
    .join("");
}

function labelTier(tier) {
  return {
    immediate: "即时提醒",
    daily: "进入日报",
    archive: "归档观察",
  }[tier] || tier;
}

function labelCategory(category) {
  return {
    partnership: "合作 / 伙伴",
    product: "产品 / 技术",
    event: "展会 / 活动",
    regulatory: "监管 / 申报",
    finance: "资本 / 财务",
    award: "奖项 / 认可",
    market: "市场扩张",
    company: "公司动态",
    uncategorized: "未分类",
  }[category] || category;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

els.tierFilter.addEventListener("change", (event) => {
  state.tier = event.target.value;
  renderSignals();
});

els.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  renderSignals();
});

els.companyFilter.addEventListener("change", (event) => {
  state.company = event.target.value;
  renderSignals();
});

els.refreshButton.addEventListener("click", loadData);

loadData();
