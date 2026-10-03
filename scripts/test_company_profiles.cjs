const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('/Users/trist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const preview = process.env.ACRO_PROFILE_OUTPUT || path.join(root, 'preview-checks/company-profiles-complete');
const target = process.env.ACRO_PROFILE_URL || pathToFileURL(path.join(root, 'web/index.html')).href;
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/company_profiles.json')));

async function run() {
  fs.mkdirSync(preview, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(target);
    await page.waitForFunction(() => typeof state !== 'undefined' && state.payload?.companies?.length === 72);
    assert.deepEqual(await page.evaluate(() => window.AIHOT_COMPANY_PROFILES.summary), registry.summary);
    assert.equal(await page.evaluate(() => state.payload.items.length), 2505);
    await page.locator('details[data-nav-cluster="companies"] > summary').click();
    await page.locator('[data-page-target="companies"]').first().click();
    const groups = await page.locator('.company-pool-block').evaluateAll(nodes => nodes.map(node => ({
      role: node.className, profiles: node.querySelectorAll('[data-company-profile]').length,
    })));
    assert.equal(groups.find(row => row.role.includes('role-self')).profiles, 1);
    assert.equal(groups.find(row => row.role.includes('role-competitor')).profiles, 21);
    assert.equal(groups.find(row => row.role.includes('role-customer')).profiles, 50);
    await page.screenshot({ path: path.join(preview, 'company-pool-desktop.png'), fullPage: false });

    await page.locator('[data-page-target="japan-customers"]').first().click();
    while (await page.locator('[data-load-more-accounts]').count()) await page.locator('[data-load-more-accounts]').click();
    assert.equal(await page.locator('.customer-directory-row').count(), 232);
    assert.equal(await page.locator('.customer-directory-row .company-bilingual-name > small').count(), 232);
    for (const id of ['jp-account-a1ca845874', 'jp-account-b20e945eeb', 'jp-account-75dc94e8d2', 'jp-account-231673cf89', 'jp-account-0ff9d137a3']) {
      await page.locator(`[data-japan-account-id="${id}"]`).click();
      const profile = page.locator(`#japanCustomerDetail [data-company-profile="${id}"]`);
      assert.equal(await profile.count(), 1);
      assert((await profile.innerText()).includes(registry.records[id].summary_zh));
      if (!registry.records[id].logo_id) assert.equal(await page.locator('#japanCustomerDetail [data-company-logo-image]').count(), 0);
    }
    await page.locator('#japanCustomerSearch').fill('凜研究所');
    assert.equal(await page.locator('.customer-directory-row').count(), 1);
    await page.locator('#japanCustomerSearch').fill('Biken');
    await page.locator('[data-japan-account-id="jp-account-b20e945eeb"]').click();
    await page.screenshot({ path: path.join(preview, 'account-profile-desktop.png'), fullPage: false });

    await page.evaluate(() => { state.timelineCompany = 'eisai'; state.page = 'company-timeline'; renderCompanyTimeline(); renderPage(); });
    assert.equal(await page.locator('#companyLivingProfile [data-company-profile="jp-account-3f15ddb6b5"]').count(), 1);
    assert((await page.locator('#companyLivingProfile').innerText()).includes('卫材'));
    await page.evaluate(() => { state.coverageCompany = 'eisai'; state.page = 'company-sources'; renderCompanySourceCoverage(); renderPage(); });
    assert.equal(await page.locator('#companyCoverageIdentity [data-company-profile="jp-account-3f15ddb6b5"]').count(), 1);

    const logoProblems = await page.evaluate(async () => {
      const records = Object.values(window.AIHOT_COMPANY_PROFILES.records).filter(row => row.logo_status === 'available');
      return (await Promise.all(records.map(row => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth > 0 ? null : row.id);
        image.onerror = () => resolve(row.id);
        image.src = window.AIHOT_COMPANY_LOGOS[row.logo_id].src;
      })))).filter(Boolean);
    });
    assert.deepEqual(logoProblems, []);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { state.page = 'japan-customers'; state.selectedAccountId = 'jp-account-b20e945eeb'; renderJapanAccountIntelligence(); renderPage(); });
    await page.locator('#japanCustomerDetail [data-company-profile]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(preview, 'account-profile-mobile.png'), fullPage: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    assert.equal(overflow, false, 'Mobile page must not overflow horizontally');
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 1440, height: 1040 });
    const imageCount = await page.evaluate(() => {
      const profiles = Object.values(window.AIHOT_COMPANY_PROFILES.records).filter(row => row.logo_status === 'available');
      document.body.innerHTML = '<div id="brandGallery"></div>';
      document.body.style.cssText = 'display:block;width:100%;height:auto;margin:0;background:#f3f6f7;padding:16px;font:14px Arial';
      const gallery = document.querySelector('#brandGallery');
      gallery.style.cssText = 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px';
      profiles.forEach(row => {
        const logo = window.AIHOT_COMPANY_LOGOS[row.logo_id];
        const dark = row.logo_background === 'dark';
        const card = document.createElement('div');
        card.style.cssText = `height:116px;padding:8px;background:${dark ? '#26343c' : '#fff'};border:1px solid #d5e0e5;overflow:hidden;color:${dark ? '#fff' : '#26343c'}`;
        const image = document.createElement('img');
        image.src = logo.src;
        image.style.cssText = 'width:100%;height:64px;object-fit:contain;display:block;margin-bottom:6px';
        const label = document.createElement('div');
        label.textContent = row.name_en;
        label.style.cssText = 'font-size:12px;line-height:1.25';
        card.append(image, label);
        gallery.append(card);
      });
      return profiles.length;
    });
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    for (let offset = 0, sheet = 1; offset < Math.ceil(imageCount / 6) * 126; offset += 1008, sheet += 1) {
      await page.evaluate(value => window.scrollTo(0, value), offset);
      await page.screenshot({ path: path.join(preview, `brand-gallery-${sheet}.png`) });
    }
    const result = { passed: true, target, companies: 72, directory: 232, profiles: 254, renderedImages: registry.summary.with_image, pageErrors: errors, mobileOverflow: overflow };
    fs.writeFileSync(path.join(root, 'reports/company-profile-ui-validation.json'), JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}
run().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
