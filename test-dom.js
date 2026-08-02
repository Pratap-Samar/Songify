const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log('Launching local Edge...');
  const browser = await puppeteer.launch({ 
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true 
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 375, height: 812 });

  console.log('Navigating to http://localhost:8082...');
  let retries = 10;
  while (retries > 0) {
    try {
      await page.goto('http://localhost:8082', { waitUntil: 'networkidle0', timeout: 5000 });
      break;
    } catch (e) {
      console.log('Waiting for dev server...');
      await new Promise(r => setTimeout(r, 2000));
      retries--;
    }
  }

  if (retries === 0) {
    console.error('Could not connect to Expo dev server');
    process.exit(1);
  }

  console.log('Page loaded. Typing search query...');
  
  const input = await page.$('input');
  if (!input) {
    console.error('Could not find search input');
    process.exit(1);
  }

  await input.type('rock');
  
  console.log('Waiting for search results to render...');
  await new Promise(r => setTimeout(r, 3000));

  const html = await page.content();
  fs.writeFileSync('dom.html', html);

  const sizes = await page.evaluate(() => {
    function getSizes(element) {
      if (!element) return null;
      const computed = window.getComputedStyle(element);
      const res = {
        tag: element.tagName,
        id: element.id,
        className: element.className,
        display: computed.display,
        flex: computed.flex,
        height: computed.height,
        minHeight: computed.minHeight,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: computed.overflowY,
        children: []
      };
      
      for (let i = 0; i < element.children.length; i++) {
        if (element.children[i].tagName !== 'SCRIPT' && element.children[i].tagName !== 'STYLE') {
          res.children.push(getSizes(element.children[i]));
        }
      }
      return res;
    }
    return getSizes(document.documentElement);
  });

  fs.writeFileSync('sizes.json', JSON.stringify(sizes, null, 2));
  console.log('Wrote DOM sizes to sizes.json');

  await browser.close();
})();
