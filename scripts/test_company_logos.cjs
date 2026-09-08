const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = process.env.LOGO_SCREENSHOT_DIR || '/tmp/acro-logo-check';

async function navigate(page, target) {
  const button = page.locator(`.nav [data-page-target="${target}"]`);
  const parent = page.locator(`.nav details:has([data-page-target="${target}"])`);
  if (await parent.count() && !await parent.evaluate(el => el.open)) {
    await parent.locator('summary').click();
  }
  await button.click();
  await page.locator(`[data-page="${target}"]`).waitFor({ state: 'visible' });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [1440, 1024, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, 'web/index.html')).href);
      await page.waitForFunction(() => document.querySelectorAll('#companyDockList [data-company-logo]').length === 34);
      assert.equal(await page.locator('#companyDockList [data-company-logo-image]').count(), 30);
      await page.locator('.nav [data-period-entry="month"]').click();
      const competitorCount = Number(await page.locator('[data-board-tab="competitor"] b').innerText());
      assert.equal(await page.locator('#boardCompanyRows [data-company-logo]').count(), competitorCount);
      await page.locator('[data-board-tab="customer"]').click();
      const customerCount = Number(await page.locator('[data-board-tab="customer"] b').innerText());
      assert.equal(await page.locator('#boardCompanyRows [data-company-logo-image]').count(), customerCount);
      const decoded = await page.evaluate(async () => {
        const failed = [];
        for (const [id, logo] of Object.entries(window.AIHOT_COMPANY_LOGOS)) {
          const image = new Image();
          image.src = logo.src;
          try {
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            const background = logo.background === 'dark' ? [52, 67, 75] : [255, 255, 255];
            ctx.fillStyle = logo.background === 'dark' ? '#34434b' : '#ffffff';
            ctx.fillRect(0, 0, 200, 100);
            ctx.drawImage(image, 0, 0, 200, 100);
            const pixels = ctx.getImageData(0, 0, 200, 100).data;
            let visible = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              if (background.some((channel, offset) => Math.abs(pixels[i + offset] - channel) > 30)) visible++;
            }
            if (visible < 25) failed.push(id + ': blank image');
          } catch { failed.push(id + ': cannot decode'); }
        }
        return failed;
      });
      assert.deepEqual(decoded, []);
      if (width === 1440) {
        await page.locator('#boardCompanyRows').screenshot({ path: path.join(output, 'customers.png') });
        await page.locator('[data-board-tab="competitor"]').click();
        await page.locator('#boardCompanyRows').screenshot({ path: path.join(output, 'competitors.png') });
      }
      await navigate(page, 'companies');
      assert.equal(await page.locator('#companyPoolGroups [data-company-logo]').count(), 34);
      await page.locator('.company-profile-row').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `companies-${width}.png`) });
      await page.locator('[data-company-coverage-id="acro"]').first().click();
      assert.equal(await page.locator('#companyCoverageTitle [data-company-logo]').getAttribute('data-company-logo'), 'acro');
      await page.locator('#companyCoverageSelect').selectOption('takeda_pharma');
      assert.equal(await page.locator('#companyCoverageTitle [data-company-logo]').getAttribute('data-company-logo'), 'takeda_pharma');
      await page.locator('#companyCoverageTitle').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `profile-${width}.png`) });
      await navigate(page, 'japan-customers');
      assert.ok(await page.locator('#japanCustomerList [data-company-logo-image]').count() > 0);
      const overflow = await page.locator('.company-name-with-logo:visible, .company-chip-main:visible').evaluateAll(rows => rows.filter(row => {
        const outer = row.getBoundingClientRect();
        return Array.from(row.children).some(child => child.getBoundingClientRect().right > outer.right + 2);
      }).map(row => row.className));
      assert.deepEqual(overflow, [], `Logo row overflow at ${width}`);
      if (width === 1440) {
        await page.locator('[data-dock-role="self"] summary').evaluate(el => { el.parentElement.open = true; });
        await page.locator('#companyDockList [data-company-logo="acro"] img').click();
        assert.match(await page.locator('#companyFilter').inputValue(), /ACRO/);
        await page.evaluate(() => {
          const img = document.querySelector('#companyDockList [data-company-logo="acro"] img');
          img.src = 'data:image/png;base64,broken';
        });
        await page.waitForFunction(() => !document.querySelector('#companyDockList [data-company-logo="acro"] img'));
        assert.match(await page.locator('#companyDockList [data-company-logo="acro"]').getAttribute('title'), /暂不可用/);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: logos, pixels, navigation, account linkage and layout`);
      await page.close();
    }
    const share = await browser.newPage();
    await share.route(/^https?:/, route => route.abort());
    await share.goto(pathToFileURL(path.join(root, 'share/acro_ai_hot_tracker_dashboard.html')).href);
    assert.equal(await share.locator('#companyDockList [data-company-logo-image]').count(), 30);
    console.log('PASS standalone sharing file without network');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
