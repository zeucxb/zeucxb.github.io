import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  const file = path.normalize(path.join(root, pathname))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200)
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const launch = { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH
const browser = await chromium.launch(launch)
const failures = []

for (const lang of ['pt', 'en', 'es', 'it']) {
  for (const width of [320, 375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(`http://127.0.0.1:${port}/index.html?lang=${lang}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#cv-exp article')
    const box = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    if (box.scroll > box.client + 1) {
      failures.push(`${lang} ${width}px scroll ${box.scroll} > client ${box.client}`)
    } else {
      console.log('ok', lang, width)
    }
    await page.close()
  }
}

await browser.close()
server.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('no horizontal overflow')
