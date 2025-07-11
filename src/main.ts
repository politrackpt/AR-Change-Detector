import { chromium, firefox, webkit } from 'playwright';

(async () => {
    const browser = await webkit.launch({headless: false, slowMo: 500}); // Launch the browser in headless mode
    const page = await browser.newPage();
    await page.goto('https://playwright.dev/');
    await page.screenshot({ path: 'example.png' });
    await browser.close();
})()