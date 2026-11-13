import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const file = path.normalize(path.join(root, pathname));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const jobs = [
  ['en', 'resume.pdf'],
  ['pt', 'resume-pt.pdf'],
  ['es', 'resume-es.pdf'],
  ['it', 'resume-it.pdf'],
];

const server = await startServer();
const port = server.address().port;
const launch = {
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
};
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch(launch);

for (const [lang, file] of jobs) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv-exp article');
  await page.evaluate(() => document.querySelectorAll('.reveal,.item').forEach((el) => el.classList.add('show')));
  await page.emulateMedia({ media: 'print' });
  const out = path.join(root, file);
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: false,
    preferCSSPageSize: true,
    tagged: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await page.close();
  console.log('wrote', file);
}

await browser.close();
server.close();
