const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const { openRules, setMode } = require('./test_region_navigation.cjs');
const model = require('../web/region-model.js');
const payload = require('../data/latest_run.json');
const before = require('../preview-checks/before-region-ai-20260909/region-audit-20260909.json').after;
const out = path.join(root, 'preview-checks');
const targetIds = before.unknownItems.map(item => item.id).sort();
const registryIds = model.semanticReviews.flatMap(review => review.ids).sort();
assert.deepEqual(registryIds, [...model.reviewScope.ids].sort());
assert.equal(new Set(registryIds).size, 146);
const statuses = { identified: 0, nonregional: 0, pending: 0 };
for (const id of registryIds) {
  const item = payload.items.find(item => item.id === id);
  const result = model.analyze(item);
  assert.ok(result.review, id);
  assert.ok(result.review.scope && result.review.note && result.review.checkedAt);
  statuses[result.review.status]++;
  for (const evidence of result.review.evidence) {
    const protocol = new URL(evidence.url).protocol;
    assert.ok(['https:', 'http:'].includes(protocol));
    if (protocol === 'http:') {
      assert.equal(evidence.material, 'snapshot');
      assert.equal(evidence.url, item.url, 'Preserve the stored source URL');
    }
    assert.ok(evidence.kind);
    assert.ok(['explicit', 'contextual', 'limited'].includes(evidence.quality));
    if (result.review.status !== 'pending') assert.ok(evidence.quote && evidence.regions.length);
    for (const region of evidence.regions) assert.ok(model.definitions.some(row => row.id === region));
  }
  if (result.review.status === 'pending') {
    assert.deepEqual(result.regions, ['unknown']);
    assert.ok(['place_missing', 'source_limited'].includes(result.reason));
  } else if (result.review.status === 'nonregional') assert.deepEqual(result.regions, ['nonregional']);
  else assert.ok(result.regions.every(region => !['unknown', 'nonregional'].includes(region)));
  assert.equal(model.analyze(item, 'content').review, null);
  assert.equal(model.reviewFor({ ...item, title: 'Changed unrelated title' }), null);
  assert.equal(model.reviewFor({ ...item, id: 'another-record' }), null);
  assert.deepEqual(model.analyze({ ...item, ai_summary: '日本 美国 欧洲 全球', ai_summary_en: 'Japan US Europe global' }).regions, result.regions);
}
assert.deepEqual(statuses, { identified: 126, nonregional: 16, pending: 4 });
assert.deepEqual(targetIds.reduce((counts, id) => {
  counts[model.reviewFor(payload.items.find(item => item.id === id)).status]++;
  return counts;
}, { identified: 0, nonregional: 0, pending: 0 }), { identified: 24, nonregional: 4, pending: 1 });
const reviewedItems = payload.items.filter(item => registryIds.includes(item.id));
const groups = model.partition(reviewedItems);
assert.equal(groups.located.length + groups.nonregional.length + groups.pending.length, 146);
assert.equal(groups.reviewed.length, 146);
assert.equal(groups.unreviewed.length, 0);
assert.equal(groups.source_limited.length, 1);
assert.equal(groups.place_missing.length, 3);
assert.equal(model.partition([...reviewedItems, reviewedItems[0]]).reviewed.length, 146);
assert.equal(model.partition([{ id: 'new-record', title: 'New item' }]).unreviewed.length, 1);
const regionOf = id => model.analyze(payload.items.find(item => item.id === id)).regions;
assert.deepEqual(regionOf('bf4f2e275594a361'), ['china', 'north_america', 'europe']);
assert.deepEqual(regionOf('780708d9f2d51226'), ['north_america']);
assert.deepEqual(regionOf('7cc7a1c1a12296a4'), ['north_america']);
assert.deepEqual(regionOf('9af268f4ae597903'), ['global']);
assert.deepEqual(regionOf('ca7fdd02fe028310'), ['global']);
assert.deepEqual(regionOf('5e7891e69fcc6c1a'), ['japan']);
assert.deepEqual(regionOf('6c91469a64ec7c2c'), ['japan']);
for (const id of ['6858bf4b793b0b96', 'ea54a465b2563822', 'c3944558211d8045', '6c11d29671d535d3', '01307febbeb56eba']) assert.deepEqual(regionOf(id), ['nonregional']);
assert.deepEqual(regionOf('a8300e5b5082d821'), ['nonregional']);
assert.deepEqual(regionOf('1a01f03a67dbfd29'), ['nonregional']);
assert.deepEqual(regionOf('68f3e7468fa79f91'), ['southeast_asia']);
assert.deepEqual(regionOf('727ccd206685c83a'), ['japan']);
assert.deepEqual(regionOf('6d3561c7f3242295'), ['unknown']);
assert.deepEqual(regionOf('3afc2b25efbc63ef'), ['nonregional']);
assert.ok(!model.apac.includes('nonregional') && !model.apac.includes('unknown'));
require('./test_data_preservation.cjs')(root, path.join(out, 'before-region-ai-20260909'));

async function snapshot(page) {
  const result = await page.evaluate(() => {
    const items = getFilteredItems();
    const coverage = document.querySelector('.fusion-region-coverage').dataset;
    const m = window.AIHOT_REGION_MODEL;
    return {
      ids: items.map(item => item.id).sort(), total: items.length,
      unknown: items.filter(item => fusionRegions(item).includes('unknown')).length,
      nonregional: items.filter(item => fusionRegions(item).includes('nonregional')).length,
      shown: { total: +coverage.regionTotal, unknown: +coverage.regionUnknown, nonregional: +coverage.regionNonregional },
      reasons: m.reasons.map(row => ({ id: row.id, count: items.filter(item => m.analyze(item, fusion.regionMode).reason === row.id).length })),
      regions: m.definitions.map(row => ({ id: row.id, ids: items.filter(item => fusionRegions(item).includes(row.id)).map(item => item.id).sort(), shown: +document.querySelector(`[data-fusion-region-detail="${row.id}"] strong`).textContent })),
      apac: items.filter(item => fusionRegions(item).some(region => overviewApacRegions.has(region))).length,
      shownApac: +document.querySelector('#metricArchive').textContent,
      reviews: items.filter(item => m.reviewFor(item)).map(item => ({ id: item.id, title: item.title, ...m.analyze(item) })),
    };
  });
  assert.equal(result.total, result.shown.total);
  assert.equal(result.unknown, result.shown.unknown);
  assert.equal(result.nonregional, result.shown.nonregional);
  assert.equal(result.unknown, result.reasons.reduce((n, row) => n + row.count, 0));
  assert.equal(result.apac, result.shownApac);
  for (const region of result.regions) assert.equal(region.ids.length, region.shown);
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, file] of [[1440, 'web/index.html'], [390, 'web/index.html'], [1440, 'share/acro_ai_hot_tracker_dashboard.html']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelector('.fusion-region-coverage'));
      const home = await snapshot(page);
      assert.deepEqual(home.ids, before.ids);
      assert.equal(home.total, 66);
      assert.equal(home.unknown, 1);
      assert.equal(home.nonregional, 4);
      assert.equal(home.reviews.length, 66);
      assert.equal(await page.locator('.fusion-geography-bars [data-fusion-region-detail="unknown"], .fusion-geography-bars [data-fusion-region-detail="nonregional"]').count(), 0);
      for (const group of ['located', 'reviewed']) {
        const expected = await page.evaluate(group => window.AIHOT_REGION_MODEL.partition(getFilteredItems(), fusion.regionMode)[group].map(item => item.id).sort(), group);
        await openRules(page);
        await page.locator(`#regionRulesContent [data-fusion-region-group="${group}"]`).click();
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expected);
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), expected.length);
        await page.locator('.nav [data-page-target="overview"]').click();
      }
      if (width === 1440 && file.startsWith('web')) {
        fs.writeFileSync(path.join(out, 'region-ai-audit-20260909.json'), JSON.stringify({ before: { total: before.total, unknown: before.unknown }, after: home, statuses }, null, 2));
      }
      await page.locator('#regionPanel').screenshot({ path: path.join(out, `region-ai-${width}-${file.startsWith('web') ? 'web' : 'standalone'}.png`) });
      for (const region of home.regions.filter(row => row.ids.length)) {
        for (const detail of await page.locator('#regionPanel .fusion-zero-regions, #regionPanel .region-family-breakdown, #regionPanel .region-scope-evidence').all()) {
          if (!await detail.evaluate(node => node.open)) await detail.locator(':scope > summary').click();
        }
        await page.locator(`[data-fusion-region-detail="${region.id}"]`).click();
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), region.ids);
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), region.ids.length);
        await page.locator('#fusionEvidence [data-fusion-back]').click();
      }
      await openRules(page);
      for (const status of Object.keys(statuses)) {
        const count = home.reviews.filter(row => row.review.status === status).length;
        assert.equal(+(await page.locator(`[data-fusion-region-review="${status}"] strong`).innerText()), count);
        await page.locator(`[data-fusion-region-review="${status}"]`).click();
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), count);
        assert.equal(await page.evaluate(status => fusion.detail.ids.every(id => window.AIHOT_REGION_MODEL.reviewFor(state.payload.items.find(item => item.id === id)).status === status), status), true);
        assert.equal(await page.locator(`#fusionEvidenceCards [data-region-review-status="${status}"]`).count(), count);
        await page.locator('#fusionEvidenceCards .fusion-region-evidence > summary').first().click();
        assert.match(await page.locator('#fusionEvidenceCards .fusion-semantic-review').first().innerText(), /核对范围/);
        if (status === 'pending') await page.locator('#fusionEvidenceCards .signal-card').first().screenshot({ path: path.join(out, `region-ai-pending-${width}.png`) });
        await page.locator('#fusionEvidence [data-fusion-region-rules]').click();
      }
      await page.screenshot({ path: path.join(out, `region-ai-rules-${width}.png`) });
      for (const reason of home.reasons.filter(row => row.count)) {
        await page.locator(`#regionRulesContent [data-fusion-region-reason="${reason.id}"]`).click();
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), reason.count);
        await page.locator('#fusionEvidence [data-fusion-region-rules]').click();
      }
      await page.locator('.nav [data-page-target="overview"]').click();
      await setMode(page, 'content');
      const content = await snapshot(page);
      assert.deepEqual(content.ids, before.ids);
      assert.ok(content.unknown >= 29);
      assert.equal(content.nonregional, 0);
      await setMode(page, 'reviewed');
      assert.equal((await snapshot(page)).unknown, 1);
      await page.locator('#fusionRegionLabel').click();
      for (const id of ['nonregional', 'unknown', 'japan']) await page.locator(`[data-fusion-region][value="${id}"]`).check();
      const filtered = await snapshot(page);
      assert.deepEqual(filtered.ids, [...new Set(home.regions.filter(row => ['nonregional', 'unknown', 'japan'].includes(row.id)).flatMap(row => row.ids))].sort());
      await page.locator('[data-fusion-regions-all]').click();
      assert.deepEqual((await snapshot(page)).ids, before.ids);
      await page.locator('[data-fusion-regions-clear]').click();
      assert.deepEqual((await snapshot(page)).ids, before.ids);
      await page.locator('#fusionRegionLabel').click();
      for (const days of [7, 90, 30]) {
        await page.locator(`[data-time-range="${days}"]`).click();
        const current = await snapshot(page);
        if (days === 90) {
          assert.equal(current.total, 146);
          assert.equal(current.unknown, 4);
          assert.equal(current.nonregional, 16);
          assert.equal(current.reviews.length, 146);
          await page.locator('#regionPanel').screenshot({ path: path.join(out, `region-full-90days-${width}.png`) });
        }
      }
      await page.locator('.nav [data-period-entry="month"]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      if (!(await page.locator('#boardRegionsSummary').isVisible())) await page.locator('#boardFilterPanel > summary').click();
      for (const mode of ['content', 'reviewed']) {
        await setMode(page, mode);
        assert.equal(await page.evaluate(() => periodView.events.every(event => {
          const all = [...new Set(event.reports.flatMap(fusionRegions))];
          const known = all.filter(region => !['unknown', 'nonregional'].includes(region));
          const expected = known.length ? known : all.includes('nonregional') ? ['nonregional'] : ['unknown'];
          return JSON.stringify([...event.regions].sort()) === JSON.stringify(expected.sort());
        })), true);
        for (const region of ['nonregional', 'japan']) {
          await page.locator('#boardRegionsSummary').click();
          await page.locator(`[data-board-region][value="${region}"]`).check();
          await page.locator('#boardRegionsSummary').click();
          const count = await page.evaluate(() => boardItems().length);
          assert.equal(+(await page.locator('[data-board-count="all"] strong').innerText()), count);
          const regionalScope = await page.evaluate(region => ({ selected: periodView.regions, unexpected: boardItems().filter(event => !event.regions.includes(region)).map(event => ({ id: event.id, regions: event.regions })) }), region);
          assert.deepEqual(regionalScope.unexpected, [], JSON.stringify({ mode, region, ...regionalScope }));
          await page.locator('[data-board-count="all"]').click();
          assert.equal(+(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), count);
          await page.locator('[data-board-back]').click();
          await page.locator('#boardRegionsSummary').click();
          await page.locator(`[data-board-region][value="${region}"]`).uncheck();
          await page.locator('#boardRegionsSummary').click();
        }
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      console.log(`PASS ${width} ${file}: 66 default / 146 expanded records unchanged; evidence, outcomes, filters, exact drilldowns, period views, back navigation.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
