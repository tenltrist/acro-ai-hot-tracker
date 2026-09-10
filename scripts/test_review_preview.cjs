const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const payload = read('data/latest_run.json');
const archive = new Map(read('data/event_archive.json').items.map(item => [item.id, item]));
const selected = payload.items.filter(item => ['daily', 'immediate'].includes(item.tier));
const prohibitedLabels = ['翻译校对', 'Translation checked', 'AI 精读', 'ChatGPT Pro 人工复核摘要', '有限材料'];

assert.equal(payload.summary_pipeline.manual_imported, payload.items.length);
assert.equal(read('data/event_archive.json').summary_pipeline.manual_imported, archive.size);
assert.deepEqual(read('api/public/items.json'), payload.items);
assert.deepEqual(read('api/public/daily.json').summary_pipeline, payload.summary_pipeline);
assert.deepEqual(read('api/public/daily.json').selected, selected);

for (const item of archive.values()) {
  assert.ok(item.title_zh && /[\u3400-\u9fff]/.test(item.title_zh), `${item.id}: Chinese title`);
  assert.ok(item.ai_summary && /[\u3400-\u9fff]/.test(item.ai_summary), `${item.id}: Chinese summary`);
  assert.equal(item.summary_method, 'manual_ai', `${item.id}: editorial summary active`);
}

for (const item of payload.items) {
  for (const key of ['title_zh', 'ai_summary', 'summary_method', 'summary_provider', 'summary_review']) {
    assert.deepEqual(archive.get(item.id)?.[key], item[key], `${item.id}: archive ${key}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const [file, widths] of [['web/index.html', [1440, 390]], ['share/acro_ai_hot_tracker_dashboard.html', [1440]]]) {
      for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route(/^https?:/, route => route.abort());
        await page.goto(pathToFileURL(path.join(root, file)).href);
        await page.waitForFunction(() => document.querySelectorAll('#topSignalList .signal-card').length > 0);

        const data = await page.evaluate(() => {
          const items = state.payload.items;
          const scoped = getFilteredItems();
          const summaries = items.map(item => fusionSummary(item, 'zh'));
          const target = scoped.find(item => item.title_zh && item.ai_summary && item.url);
          refreshPeriodEvents();
          state.translationLanguage = 'zh';
          periodView.language = 'zh';
          return {
            itemCount: items.length,
            missing: summaries.filter(summary => summary.missing).length,
            wrongLabel: summaries.filter(summary => summary.label !== '摘要').length,
            processingBadges: summaries.filter(summary => summary.ai).length,
            reviewMarkup: items.filter(item => renderSummaryReview(item)).length,
            targetId: target.id,
            bodyText: document.body.innerText,
          };
        });

        assert.equal(data.itemCount, payload.items.length);
        assert.equal(data.missing, 0);
        assert.equal(data.wrongLabel, 0);
        assert.equal(data.processingBadges, 0);
        assert.equal(data.reviewMarkup, 0);
        assert.equal(await page.locator('.summary-review').count(), 0);
        for (const label of prohibitedLabels) assert.ok(!data.bodyText.includes(label), `${file}: ${label}`);

        const firstCard = page.locator('#topSignalList .signal-card').first();
        const summaryToggle = firstCard.locator('.business-summary-toggle > summary');
        if (await summaryToggle.count()) await summaryToggle.click();
        const sourceLink = firstCard.locator('.summary-original').first();
        assert.equal(await sourceLink.innerText(), '查看原文 ↗');
        assert.match(await sourceLink.getAttribute('href'), /^https?:\/\//);
        assert.equal((await firstCard.innerText()).includes('摘要'), true);

        await page.locator('.nav [data-period-entry="month"]').click();
        await page.waitForSelector('#boardTimeline [data-board-event]');
        await page.locator('#boardTimeline [data-board-event]').first().click();
        await page.waitForSelector('.board-evidence-page');
        assert.ok((await page.locator('.board-evidence-page h2').innerText()).length > 0);
        assert.ok((await page.locator('.board-full-summary').innerText()).length > 0);
        assert.ok(await page.locator('.board-evidence-page a[href^="http"]').count() > 0);
        assert.deepEqual(errors, []);

        if (file.startsWith('web')) {
          await page.screenshot({ path: path.join(root, `preview-checks/editorial-${width}.png`), fullPage: false });
        }
        results.push({ file, width, itemCount: data.itemCount, translated: data.itemCount });
        console.log('PASS', JSON.stringify(results.at(-1)));
        await page.close();
      }
    }
    fs.writeFileSync(path.join(root, 'preview-checks/editorial-results.json'), JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
