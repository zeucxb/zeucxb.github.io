import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const html = fs.readFileSync('index.html', 'utf8')
const errors = []

if (!html.startsWith('<!DOCTYPE html>')) errors.push('missing <!DOCTYPE html>')
for (const tag of ['<html', '</html>', '<head', '</head>', '<body', '</body>']) {
  if (!html.includes(tag)) errors.push('missing ' + tag)
}
if (!/<title>[^<]+<\/title>/.test(html)) errors.push('missing <title>')

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
if (scripts.length !== 1) errors.push('expected one inline script, found ' + scripts.length)
else {
  fs.writeFileSync('/tmp/site-check.js', scripts[0][1])
  const checked = spawnSync(process.execPath, ['--check', '/tmp/site-check.js'], { encoding: 'utf8' })
  if (checked.status !== 0) errors.push('script syntax error\n' + checked.stderr)
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
const seen = new Set()
for (const id of ids) {
  if (seen.has(id)) errors.push('duplicate id #' + id)
  seen.add(id)
}
for (const id of ['top', 'sobre', 'trajetoria', 'skills', 'comunidade', 'formacao', 'curriculo', 'contato']) {
  if (!seen.has(id)) errors.push('missing id #' + id)
}

for (const href of html.matchAll(/\shref="#([^"]+)"/g)) {
  if (!seen.has(href[1])) errors.push('broken anchor #' + href[1])
}

const refs = [
  ...html.matchAll(/\s(?:src|href)="([^"]+)"/g),
].map((m) => m[1])
for (const ref of refs) {
  if (/^(https?:|mailto:|\/\/|#|\?)/.test(ref)) continue
  const file = ref.replace(/^\//, '').split('?')[0]
  if (!file || file.includes('..')) {
    errors.push('unsafe asset path ' + ref)
    continue
  }
  if (!fs.existsSync(file)) errors.push('missing asset ' + ref)
}

for (const file of ['avatar.png', 'resume.pdf', 'resume-pt.pdf', 'resume-es.pdf', 'resume-it.pdf']) {
  if (!fs.existsSync(file)) errors.push('missing ' + file)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('html ok:', ids.length, 'ids,', refs.length, 'refs')
