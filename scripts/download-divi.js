#!/usr/bin/env node
// Downloads Divi 4 and Divi 5 from Elegant Themes members area.
// Usage: node download-divi.js   (prompts for credentials)

const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const readline = require('readline');

const DEST = path.join(os.homedir(), 'Downloads');

async function prompt(question, silent = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    if (silent) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      let val = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = ch => {
        if (ch === '\n' || ch === '\r' || ch === '') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(val);
        } else if (ch === '') {
          val = val.slice(0, -1);
        } else {
          val += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
    }
  });
}

async function run() {
  // Accept credentials as args: node download-divi.js <email> <password>
  // or via env: ET_USER / ET_PASS
  const username = process.argv[2] || process.env.ET_USER || await prompt('Elegant Themes username/email: ');
  const password = process.argv[3] || process.env.ET_PASS || await prompt('Password: ', true);

  console.log('\n→ Launching browser...');
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // ── Login ────────────────────────────────────────────────────────────────
  console.log('→ Logging in to Elegant Themes...');
  await page.goto('https://www.elegantthemes.com/members-area/');
  await page.waitForLoadState('networkidle');

  const userField = page.locator('#user_login, input[name="username"], input[name="user_login"]').first();
  const passField = page.locator('#user_pass, input[name="password"], input[name="user_pass"]').first();

  await userField.fill(username);
  await passField.fill(password);
  await passField.press('Enter');
  await page.waitForLoadState('networkidle');

  if (page.url().includes('login') || page.url().includes('members-area') === false) {
    const err = await page.locator('.login-error, .error, [class*="error"]').first().textContent().catch(() => '');
    console.error('✗ Login failed:', err || 'check credentials');
    await browser.close();
    process.exit(1);
  }
  console.log('  ✓ Logged in');

  // ── Downloads page ────────────────────────────────────────────────────────
  await page.goto('https://www.elegantthemes.com/members-area/downloads/');
  await page.waitForLoadState('networkidle');

  // Find all download links, filter for Divi
  const links = await page.$$eval('a[href*="download"], a[href*=".zip"]', els =>
    els.map(el => ({ text: el.textContent.trim(), href: el.href }))
       .filter(l => /divi/i.test(l.text) || /divi/i.test(l.href))
  );

  console.log('\nFound Divi download links:');
  links.forEach((l, i) => console.log(`  [${i}] ${l.text} — ${l.href}`));

  if (!links.length) {
    console.error('✗ No Divi download links found. The page layout may have changed.');
    console.log('  Current URL:', page.url());
    await page.screenshot({ path: path.join(DEST, 'et-debug.png') });
    console.log('  Screenshot saved to ~/Downloads/et-debug.png');
    await browser.close();
    process.exit(1);
  }

  // ── Download each Divi file ───────────────────────────────────────────────
  for (const link of links) {
    console.log(`\n→ Downloading: ${link.text}`);
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        page.goto(link.href),
      ]);
      const suggested = download.suggestedFilename();
      const dest = path.join(DEST, suggested);
      await download.saveAs(dest);
      console.log(`  ✓ Saved to ~/Downloads/${suggested}`);
    } catch (e) {
      console.warn(`  ⚠ Could not download ${link.text}:`, e.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Done. Zip files saved to ~/Downloads/');
  console.log('  Install: WP Admin → Appearance → Themes → Upload Theme');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await browser.close();
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
