const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const { openRules, setMode } = require('./test_region_navigation.cjs');
const out = path.join(root, 'preview-checks');
const baseline = JSON.parse(fs.readFileSync(path.join(out, 'before-region-rules-20260909/audit.json')));

async function scope(page) {
  const data = await page.evaluate(() => {
    const items = getFilteredItems();
    const m = window.AIHOT_REGION_MODEL;
    const coverage = document.querySelector('.fusion-region-coverage').dataset;
    return {
      ids: items.map(i => i.id).sort(), total: items.length,
      shownTotal: Number(coverage.regionTotal), shownUnknown: Number(coverage.regionUnknown),
      unknown: items.filter(i => fusionRegions(i).includes('unknown')).length,
      reasons: m.reasons.map(reason => ({ id: reason.id, count: items.filter(i => m.analyze(i, fusion.regionMode).reason === reason.id).length })),
      apac: items.filter(i => fusionRegions(i).some(r => overviewApacRegions.has(r))).length,
      shownApac: Number(document.querySelector('#metricArchive').textContent),
      regions: m.definitions.map(r => ({ id: r.id, label: r.label, ids: items.filter(i => fusionRegions(i).includes(r.id)).map(i => i.id).sort(), shown: Number(document.querySelector(`[data-fusion-region-detail="${r.id}"] strong`).textContent) })),
      unknownItems: items.filter(i => fusionRegions(i).includes('unknown')).map(i => ({ id: i.id, title: i.title, reason: m.analyze(i, fusion.regionMode).reason })),
    };
  });
  assert.equal(data.total, data.shownTotal);
  assert.equal(data.unknown, data.shownUnknown);
  assert.equal(data.unknown, data.reasons.reduce((n, r) => n + r.count, 0));
  assert.equal(data.apac, data.shownApac);
  for (const region of data.regions) assert.equal(region.ids.length, region.shown);
  return data;
}

(async () => {
  require('./test_data_preservation.cjs')(root, path.join(out, 'before-region-rules-20260909'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, file] of [[1440, 'web/index.html'], [390, 'web/index.html'], [1440, 'share/acro_ai_hot_tracker_dashboard.html']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelector('.fusion-region-coverage'));
      const home = await scope(page);
      assert.deepEqual(home.ids, [...baseline.ids].sort());
      assert.ok(home.unknown < baseline.items.filter(i => i.regions.includes('unknown')).length);
      assert.equal(await page.evaluate(() => fusion.regionMode), 'reviewed');
      if (width === 1440 && file === 'web/index.html') {
        fs.writeFileSync(path.join(out, 'region-audit-20260909.json'), JSON.stringify({ before: { total: baseline.ids.length, unknown: baseline.items.filter(i => i.regions.includes('unknown')).length }, after: home }, null, 2));
      }
      await page.locator('#regionPanel').screenshot({ path: path.join(out, `regions-${width}-${file.startsWith('share') ? 'standalone' : 'web'}.png`) });
      for (const region of home.regions.filter(r => r.ids.length)) {
        for (const detail of await page.locator('#regionPanel .fusion-zero-regions, #regionPanel .region-family-breakdown, #regionPanel .region-scope-evidence').all()) {
          if (!await detail.evaluate(node => node.open)) await detail.locator(':scope > summary').click();
        }
        await page.locator(`[data-fusion-region-detail="${region.id}"]`).click();
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), region.ids.length);
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), region.ids);
        await page.locator('#fusionEvidence [data-fusion-back]').click();
      }
      await openRules(page);
      assert.match(await page.locator('#methodologyDetailBar .methodology-breadcrumb').innerText(), /分类与业务输出.*地区判读与统计/s);
      assert.equal(await page.locator('.fusion-region-taxonomy > div').count(), home.regions.length);
      assert.ok(await page.locator('.fusion-region-rules a[href^="https:"]').count() >= 9);
      await page.screenshot({ path: path.join(out, `region-rules-${width}.png`) });
      for (const reason of home.reasons.filter(r => r.count)) {
        await page.locator(`#regionRulesContent [data-fusion-region-reason="${reason.id}"]`).click();
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), reason.count);
        assert.equal(await page.evaluate(reason => fusion.detail.ids.every(id => window.AIHOT_REGION_MODEL.analyze(state.payload.items.find(i => i.id === id), fusion.regionMode).reason === reason), reason.id), true);
        await page.locator('#fusionEvidence [data-fusion-region-rules]').click();
      }
      await page.locator('.nav [data-page-target="overview"]').click();
      await setMode(page, 'content');
      const content = await scope(page);
      assert.deepEqual(content.ids, home.ids);
      assert.ok(content.unknown >= home.unknown);
      await setMode(page, 'reviewed');
      await page.locator('#fusionRegionLabel').click();
      for (const id of ['oceania', 'europe', 'unknown']) await page.locator(`[data-fusion-region][value="${id}"]`).check();
      const filtered = await scope(page);
      assert.deepEqual(filtered.ids, [...new Set(home.regions.filter(r => ['oceania', 'europe', 'unknown'].includes(r.id)).flatMap(r => r.ids))].sort());
      await page.locator('[data-fusion-regions-all]').click();
      assert.deepEqual((await scope(page)).ids, home.ids);
      await page.locator('[data-fusion-regions-clear]').click();
      assert.deepEqual((await scope(page)).ids, home.ids);
      await page.locator('#fusionRegionLabel').click();
      for (const days of [7, 90, 30]) { await page.locator(`[data-time-range="${days}"]`).click(); await scope(page); }
      await page.locator('.nav [data-period-entry="month"]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      if (!(await page.locator('#boardRegionsSummary').isVisible())) await page.locator('#boardFilterPanel > summary').click();
      for (const mode of ['content', 'reviewed']) {
        await setMode(page, mode);
        assert.equal(await page.evaluate(() => periodView.events.every(event => {
          const regions = [...new Set(event.reports.flatMap(fusionRegions))].filter(id => id !== 'unknown');
          return JSON.stringify([...event.regions].sort()) === JSON.stringify((regions.length ? regions : ['unknown']).sort());
        })), true);
        await page.locator('#boardRegionsSummary').click();
        await page.locator('[data-board-region][value="oceania"]').check();
        await page.locator('#boardRegionsSummary').click();
        const periodCount = await page.evaluate(() => boardItems().length);
        assert.equal(Number(await page.locator('[data-board-count="all"] strong').innerText()), periodCount);
        assert.equal(await page.evaluate(() => boardItems().every(event => event.regions.includes('oceania'))), true);
        await page.locator('[data-board-count="all"]').click();
        assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), periodCount);
        await page.locator('[data-board-back]').click();
        await page.locator('#boardRegionsSummary').click();
        await page.locator('[data-board-region][value="oceania"]').uncheck();
        await page.locator('#boardRegionsSummary').click();
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      console.log(`PASS ${width} ${file}: ${home.total} unchanged records, unknown ${baseline.items.filter(i => i.regions.includes('unknown')).length} -> ${home.unknown}; regions, causes, filter, periods and breadcrumbs consistent.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
