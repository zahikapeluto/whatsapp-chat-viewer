import { readFile, writeFile } from 'node:fs/promises'

const lockPath = new URL('../../package-lock.json', import.meta.url)
const privateRegistry = 'https://artifact.it.att.com/artifactory/api/npm/apm0039531-npm-group/'
const publicRegistry = 'https://registry.npmjs.org/'
const lock = JSON.parse(await readFile(lockPath, 'utf8'))
let rewritten = 0

for (const entry of Object.values(lock.packages)) {
  if (entry.resolved?.startsWith(privateRegistry)) {
    entry.resolved = publicRegistry + entry.resolved.slice(privateRegistry.length)
    rewritten++
  }
}

if (rewritten === 0) {
  throw new Error('No company registry URLs were found in package-lock.json')
}

await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
console.log(`Prepared ${rewritten} package URLs for public npm`)