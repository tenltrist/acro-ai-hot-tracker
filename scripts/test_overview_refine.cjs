const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const result = [];
const pass = label => { result.push(label); console.log('PASS', label); };

async function verifyScope(page) {
  const data = await page.evaluate(() => {
    const items = getFilteredItems();
    const rows = fusionAccountRows(items);
    const roles = new Map(state.payload.companies.map(company => [company.id, company.business_role]));
    const customerIds = getOverviewMetricItems('customer', items, roles).map(item => item.id).sort();
    const rowIds = fusionUniqueItems(rows.flatMap(row => row.items)).map(item => item.id).sort();
    return {
      total: items.length,
      displayed: Number(document.querySelector('#fusionTotals strong').textContent),
      latest: [...document.querySelectorAll('#topSignalList .signal-card')].map(card => card.dataset.itemId || card.querySelector('[data-feedback-id]')?.dataset.feedbackId),
      customerIds, rowIds,
      metricCustomer: Number(document.querySelector('#metricImmediate').textContent),
      categories: [...document.querySelectorAll('[data-fusion-category]')].map(el => ({ count: Number(el.querySelector('strong').textContent), expected: items.filter(item => getBusinessEventType(item) === el.dataset.fusionCategory).length })),
      topics: [...document.querySelectorAll('[data-fusion-topic]')].map(el => {
        const matches = items.filter(item => fusionTopics(item).includes(el.dataset.fusionTopic));
        return { count: Number(el.querySelector('span').textContent.match(/\d+/)[0]), expected: matches.length,
          companies: Number(el.querySelectorAll('span')[1].textContent.match(/\d+/)[0]), expectedCompanies: fusionCompanyIds(matches).length };
      }),
      regions: [...document.querySelectorAll('[data-fusion-region-detail]')].map(el => ({ count: Number(el.querySelector('strong').textContent), expected: items.filter(item => fusionRegions(item).includes(el.dataset.fusionRegionDetail)).length })),
    };
  });
  assert.equal(data.displayed, data.total);
  assert.deepEqual(data.customerIds, data.rowIds);
  assert.equal(data.metricCustomer, data.rowIds.length);
  assert.equal(data.categories.reduce((total, row) => total + row.count, 0), data.total);
  for (const row of [...data.categories, ...data.topics, ...data.regions]) assert.equal(row.count, row.expected);
  for (const row of data.topics) assert.equal(row.companies, row.expectedCompanies);
  return data.total;
}

(async () => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'data/latest_run.json')));
  const daily = JSON.parse(fs.readFileSync(path.join(root, 'api/public/daily.json')));
  const publicItems = JSON.parse(fs.readFileSync(path.join(root, 'api/public/items.json')));
  const accounts = JSON.parse(fs.readFileSync(path.join(root, 'config/japan_accounts.json')));
  assert.equal(daily.generated_at, payload.generated_at);
  assert.deepEqual(publicItems, payload.items);
  assert.equal(accounts.accounts.length, 232);
  pass('current snapshot, public API and 232-account directory are synchronized');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'web/index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('#topSignalList .signal-card').length > 0);
    const units = await page.evaluate(() => {
      const old = { id: 'old', title: 'Old announcement', published: '2026-08-01', score: 99, tier: 'daily' };
      const fresh = { id: 'fresh', title: 'New announcement', published: '2026-09-08', score: 1, tier: 'daily' };
      const unknown = { id: 'unknown', title: 'Undated announcement', fetched_at: '2026-09-09', score: 100, tier: 'daily' };
      const invalid = { id: 'invalid', title: 'Invalid date', published: '2026-02-30', score: 100 };
      const sitemap = { id: 'sitemap', title: 'Crawl-only date', published: '2026-09-09', evidence: { source_types: ['sitemap_urls'] } };
      const input = [old, unknown, fresh, invalid, sitemap];
      const sameDay = [{ ...fresh, id: 'early', published: '2026-09-08T01:00:00Z' }, { ...fresh, id: 'late', published: '2026-09-08T19:00:00Z' }];
      const en = 'Aster released a fluorescent antibody panel for identifying activated T cells in laboratory samples, with a revised validation protocol for researchers.';
      const zh = '星辉公司发布了一套用于识别活化T细胞的荧光抗体组合，并公布了配套实验验证流程。公告介绍了试剂组合的适用样本和检测步骤，没有给出临床应用结论。';
      const base = { title: 'Aster laboratory announcement', url: 'https://example.com/news', summary_method: 'manual_ai' };
      const summaryCases = {
        both: ['zh', 'en'].map(language => fusionSummary({ ...base, ai_summary: zh, ai_summary_en: en }, language)),
        zhOnly: ['zh', 'en'].map(language => fusionSummary({ ...base, ai_summary: zh }, language)),
        enOnly: ['zh', 'en'].map(language => fusionSummary({ ...base, ai_summary_en: en }, language)),
        neither: ['zh', 'en'].map(language => fusionSummary(base, language)),
        shortExcerpt: fusionSummary({ ...base, ai_summary: zh, summary_review: { scope_zh: '仅核对公开简介与短摘录，未读取全文。' } }, 'zh'),
        titleOnly: fusionSummary({ ...base, ai_summary_en: base.title }, 'en'),
        rules: fusionSummary({ ...base, summary_method: 'rule_extractive', ai_summary_en: en }, 'en'),
        tasksOnly: fusionSummary({ ...base, ai_summary: '今天应安排销售团队必须联系该公司，同时请产品团队整理目前已有的所有实验方案和材料，并由销售团队负责后续联系及记录相关客户需求。' }, 'zh'),
        sourceFallback: fusionSummary({ ...base, summary_method: 'rule_extractive', summary: en, evidence: { source_excerpt: '日本語の短い紹介です。' } }, 'en'),
      };
      const saved = { ...state };
      state.payload = { ...state.payload, items: [old, fresh, unknown], generated_at: '2026-09-09' };
      Object.assign(state, { page: 'overview', tier: 'all', role: 'all', company: 'all', category: 'all', signalType: 'all', relevance: 'all', searchQuery: '', sourceOutputId: 'all', timeRange: 90 });
      const scoreOrder = getFilteredItems().map(item => item.id);
      const unknownIds = getFilteredItems(true, 'unknown').map(item => item.id);
      const unknownCategory = getBusinessEventType(unknown);
      Object.assign(state, saved);
      return { latest: fusionLatest(input).map(item => item.id), inputIds: input.map(item => item.id), sameDay: fusionLatest(sameDay).map(item => item.id),
        scoreOrder, unknownIds, unknownCategory, summaryCases,
        topicAliases: fusionTopics({ title: 'Antibody antibodies 抗体 for cell and gene therapy (CGT)', intelligence: { modalities: ['Antibody', 'antibodies', 'CGT'], business_actions: ['合作 / 共同开发'] } }),
        unknownTopics: fusionTopics({ title: 'Corporate bulletin' }),
        factualZh: fusionFactualText('公司发布新试剂。今天应安排销售必须联系该公司。'),
        factualEn: fusionFactualText('Aster released a reagent. The sales team should contact the company.'),
      };
    });
    assert.deepEqual(units.latest, ['fresh', 'old']);
    assert.deepEqual(units.inputIds, ['old', 'unknown', 'fresh', 'invalid', 'sitemap']);
    assert.deepEqual(units.sameDay, ['late', 'early']);
    assert.deepEqual(units.scoreOrder, ['old', 'fresh']);
    assert.deepEqual(units.unknownIds, ['unknown']);
    assert.equal(units.unknownCategory, 'unclassified');
    pass('new low-score news precedes old high-score news; unknown dates excluded; score ordering elsewhere preserved');
    const cases = units.summaryCases;
    assert.ok(cases.both.every(summary => !summary.missing && !summary.ai));
    assert.ok(!cases.zhOnly[0].missing && !cases.zhOnly[0].ai && cases.zhOnly[1].missing);
    assert.ok(cases.enOnly[0].missing && !cases.enOnly[1].missing && !cases.enOnly[1].ai);
    assert.ok(cases.neither.every(summary => summary.missing));
    assert.ok(!cases.shortExcerpt.ai && cases.shortExcerpt.limited);
    assert.equal(cases.shortExcerpt.label, "摘要");
    assert.ok(cases.titleOnly.missing && cases.rules.missing && cases.tasksOnly.missing);
    assert.ok(!cases.sourceFallback.ai && !cases.sourceFallback.missing);
    assert.equal(units.factualZh, '公司发布新试剂。');
    assert.equal(units.factualEn, 'Aster released a reagent.');
    pass('bilingual, Chinese-only, English-only, missing and limited-material summaries; no title/template or task fallback');
    assert.equal(units.topicAliases.filter(topic => topic === '抗体').length, 1);
    assert.ok(units.topicAliases.includes('CGT'));
    assert.ok(!units.topicAliases.includes('合作 / 共同开发'));
    assert.deepEqual(units.unknownTopics, ['unidentified']);
    pass('technical aliases deduplicated, overlapping topics retained, business actions not treated as topics');
    const baseline = await verifyScope(page);
    const homeIds = await page.evaluate(() => getFilteredItems().map(item => item.id));
    const dateOrder = await page.evaluate(() => ({ expected: fusionLatest(getFilteredItems()).map(item => item.url), actual: [...document.querySelectorAll('#topSignalList .signal-title')].map(el => el.href) }));
    assert.deepEqual(dateOrder.actual, dateOrder.expected);

    await page.locator('#fusionRegionLabel').click();
    await page.locator('[data-fusion-region][value="japan"]').check();
    await page.locator('[data-fusion-region][value="korea"]').check();
    const chosen = await page.evaluate(() => getFilteredItems().map(item => item.id));
    const expected = await page.evaluate(ids => state.payload.items.filter(item => ids.includes(item.id) && fusionRegions(item).some(region => ['japan', 'korea'].includes(region))).sort((a, b) => b.score - a.score).map(item => item.id), homeIds);
    assert.deepEqual(chosen, expected);
    await verifyScope(page);
    const category = await page.evaluate(() => getBusinessEventType(getFilteredItems()[0]));
    await page.locator('#fusionCategory').selectOption(category);
    assert.ok(await page.evaluate(() => getFilteredItems().every(item => fusionRegions(item).some(region => ['japan', 'korea'].includes(region)) && getBusinessEventType(item) === state.category)));
    await verifyScope(page);
    await page.locator('#fusionCategory').selectOption('all');
    await page.locator('[data-fusion-regions-all]').click();
    assert.equal(await verifyScope(page), baseline);
    assert.equal(await page.locator('[data-fusion-region]:checked').count(), await page.evaluate(() => regionDefinitions.length));
    await page.locator('[data-fusion-regions-clear]').click();
    assert.equal(await page.locator('[data-fusion-region]:checked').count(), 0);
    assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id)), homeIds);
    await page.locator('#fusionRegionLabel').click();
    pass('region union, cross-dimension intersection, select all and clear stay consistent across all counters');

    for (const selector of ['[data-fusion-category]', '[data-fusion-topic]', '[data-fusion-region-detail]:not(:disabled)']) {
      const target = page.locator(selector).first();
      const expectedIds = await target.evaluate(el => getFilteredItems().filter(item => el.dataset.fusionCategory ? getBusinessEventType(item) === el.dataset.fusionCategory : el.dataset.fusionTopic ? fusionTopics(item).includes(el.dataset.fusionTopic) : fusionRegions(item).includes(el.dataset.fusionRegionDetail)).map(item => item.id).sort());
      await target.click();
      assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expectedIds);
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), expectedIds.length);
      assert.equal(await page.locator('#fusionEvidence .methodology-breadcrumb').isVisible(), true);
      await page.locator('#fusionEvidence [data-fusion-back]').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id)), homeIds);
    }
    pass('composition/topic counts and exact drilldown IDs agree, breadcrumbs and return retain filters');

    const account = await page.evaluate(() => {
      const row = fusionAccountRows(getFilteredItems()).find(row => row.company && row.account);
      return { key: row.key, companyId: row.company.id, ids: row.items.map(item => item.id).sort() };
    });
    await page.locator(`[data-fusion-profile="${account.key}"]`).click();
    assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), account.ids);
    await page.locator(`[data-fusion-directory-account="${account.key}"]`).click();
    assert.equal(Number(await page.locator('#japanCustomerCount').innerText()), 232);
    assert.deepEqual(await page.evaluate(id => fusionScopedAccountIndex().get(id).map(item => item.id).sort(), account.key), account.ids);
    assert.match(await page.locator('#japanCustomerDetail').innerText(), new RegExp(`关联外部动态 · ${account.ids.length} 条`));
    await page.locator(`[data-fusion-account-news="${account.key}"]`).click();
    assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), account.ids.length);
    await page.locator('#fusionEvidence [data-fusion-back]').click();
    await page.locator('[data-fusion-company-pool]').click();
    const pool = page.locator(`[data-fusion-pool-news="${account.companyId}"]`);
    assert.match(await pool.innerText(), new RegExp(`${account.ids.length} 条新闻`));
    await pool.click();
    assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), account.ids);
    await page.locator('#fusionEvidence [data-fusion-back]').click();
    pass('customer overview, 232-account directory, company pool and detail share identical news IDs');

    const unknownIds = await page.evaluate(() => getFilteredItems(true, 'unknown').map(item => item.id).sort());
    assert.ok(unknownIds.length > 0);
    await page.locator('#fusionUnknownDates').click();
    assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), unknownIds);
    assert.match(await page.locator('#fusionEvidence .fusion-evidence-heading').innerText(), /未计入周期/);
    assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), unknownIds.length);
    await page.locator('#fusionEvidence [data-fusion-back]').click();
    assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id)), homeIds);
    pass('undated records have a separate real-data drilldown without being counted as recent news');

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.fusion-customer-row').first().screenshot({ path: path.join(root, `preview-checks/customer-refine-${width}.png`) });
      await page.locator('.fusion-topics-panel').screenshot({ path: path.join(root, `preview-checks/topics-refine-${width}.png`) });
      await page.locator('.category-panel').screenshot({ path: path.join(root, `preview-checks/categories-refine-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    for (const language of ['zh', 'en']) {
      await page.evaluate(language => { state.translationLanguage = language; renderOverviewScope(); }, language);
      for (const intent of ['action', 'account', 'competitor']) {
        await page.locator(`[data-assistant-view="${intent}"]`).click();
        const content = await page.locator('main').innerText();
        assert.doesNotMatch(content, /今日优先|重点账户|大客户动态|今天应|必须联系|优先跟进|规则提要|规则摘要|sales team should|technical support should/);
        assert.equal(await page.locator('.business-insight-action:visible').count(), 0);
        assert.equal(await page.locator('#healthStatus').isVisible(), false);
        assert.equal(await page.locator('#fusionSourceStages').isVisible(), false);
      }
      assert.ok(await page.locator('#topSignalList .summary-original').count() > 0);
    }
    await page.locator('.nav details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
    await page.locator('.nav [data-page-target="source-health"]').click();
    assert.equal(await page.locator('#fusionSourceStages').isVisible(), true);
    const health = await page.evaluate(() => {
      const rows = getSourceHealthRows();
      return { actual: [...document.querySelectorAll('#fusionSourceStages strong')].map(el => Number(el.textContent)),
        expected: [rows.length, rows.filter(row => row.operational_status === 'reachable').length, rows.filter(row => row.total > 0).length, rows.filter(row => row.daily + row.immediate > 0).length],
        runtime: document.querySelector('#healthGeneratedAt').textContent };
    });
    assert.deepEqual(health.actual, health.expected);
    assert.ok(health.runtime.includes(payload.generated_at.slice(0, 10)));
    assert.deepEqual(errors, []);
    pass('overview has no automated tasks or maintenance status; source-health stages and run time verified');
    fs.writeFileSync(path.join(root, 'preview-checks/overview-refine-results.json'), JSON.stringify({ passed: result, baseline, account, health }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
