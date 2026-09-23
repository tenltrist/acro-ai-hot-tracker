async function openRules(page) {
  await page.locator('.nav [data-page-target="methodology"]').click();
  await page.locator('[data-methodology-target="region-classification"]').click();
}
async function setMode(page, mode) {
  const isPeriod = await page.evaluate(() => ['period-overview', 'period-detail'].includes(state.page));
  const priorUrl = page.url();
  await openRules(page);
  await page.locator('#fusionRegionMode').selectOption(mode);
  if (isPeriod) {
    await page.goBack();
    await page.goBack();
    await page.waitForURL(priorUrl);
    await page.waitForFunction(() => ['period-overview', 'period-detail'].includes(state.page));
  } else await page.locator('.nav [data-page-target="overview"]').click();
}
module.exports = { openRules, setMode };
