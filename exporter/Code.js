/**
 * NIPUN+ Basti dashboard exporter.
 *
 * Runs as a Central Square Foundation account that can see the shared
 * "Nipun+ School Wise Competency Wise Data" Drive folder. Every night it looks
 * through the month folders ("Aug 2026", "July 2026/Grades 1-5 (Updated)", ...)
 * for Basti files that are new or changed, and commits them unchanged to
 * data/raw/<YYYY-MM>/ in the dashboard's GitHub repo. A GitHub Action then
 * rebuilds the dashboard data and redeploys the site.
 *
 * The files hold school-level counts only (school, block, UDISE, enrolment,
 * learning-outcome results): no names of children or teachers.
 *
 * One-time setup (Project Settings > Script properties):
 *   GITHUB_TOKEN  fine-grained token: this repo only, Contents read/write
 * Then run setup() once from the editor to create the nightly trigger.
 *
 * Useful functions to run by hand: runExport(), status(), resetState().
 */

const CONFIG = {
  SOURCE_FOLDER_ID: '1XmVzEYtlrOJO02qZMc21FStVWC1k-kz9', // Nipun+ School Wise Competency Wise Data
  GITHUB_REPO: 'AdiChandrashekar/NIPUN-Basti-Dashboard',
  GITHUB_BRANCH: 'main',
  RAW_DIR: 'data/raw',
  DISTRICT: 'basti', // matched case-insensitively against file names
  EXTENSIONS: /\.(xls|xlsx|xlsm)$/i,
  TIME_BUDGET_MS: 4.5 * 60 * 1000,
}

// ---------------------------------------------------------------- entry points

/** Create the nightly trigger and run the first export. Run once. */
function setup() {
  if (!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')) {
    throw new Error('Add GITHUB_TOKEN under Project Settings > Script properties first.')
  }
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'runExport')
    .forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('runExport').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Kolkata').create()
  console.log('Nightly trigger created (03:00 IST). Starting the first export now.')
  runExport()
}

/** Commit every new or changed Basti file in one commit. */
function runExport() {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(1000)) return console.log('Another export is running.')
  const started = Date.now()
  try {
    const todo = findChangedFiles_()
    console.log(`${todo.length} file(s) to export`)
    const entries = []
    const done = []
    for (const item of todo) {
      if (Date.now() - started > CONFIG.TIME_BUDGET_MS) break
      const blob = item.file.getBlob()
      const sha = github_('post', '/git/blobs', { content: Utilities.base64Encode(blob.getBytes()), encoding: 'base64' }).sha
      entries.push({ path: `${CONFIG.RAW_DIR}/${item.month}/${item.name}`, mode: '100644', type: 'blob', sha })
      done.push(item)
      console.log(`exported ${item.month}/${item.name}`)
    }
    if (entries.length) {
      commit_(entries, `NIPUN+ data: ${done.map((d) => `${d.month}/${d.name}`).join(', ')}`)
      const props = PropertiesService.getScriptProperties()
      done.forEach((d) => props.setProperty(`f_${d.file.getId()}`, String(d.file.getLastUpdated().getTime())))
    }
    PropertiesService.getScriptProperties().setProperty(
      'LAST_RUN',
      JSON.stringify({ at: new Date().toISOString(), exported: done.length, remaining: todo.length - done.length }),
    )
    console.log(`done: ${done.length} exported, ${todo.length - done.length} remaining`)
  } finally {
    lock.releaseLock()
  }
}

/** What has been exported, and what's still waiting. */
function status() {
  console.log('Last run:', PropertiesService.getScriptProperties().getProperty('LAST_RUN'))
  const todo = findChangedFiles_()
  console.log(`${todo.length} file(s) waiting:`, todo.map((t) => `${t.month}/${t.name}`).join(', '))
}

/** Forget what was exported, so the next run re-exports everything. */
function resetState() {
  const props = PropertiesService.getScriptProperties()
  Object.keys(props.getProperties())
    .filter((k) => k.startsWith('f_'))
    .forEach((k) => props.deleteProperty(k))
  console.log('Export state cleared.')
}

// ---------------------------------------------------------------- Drive

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/** "Aug 2026", "Sept 2026", "July 2026" -> "2026-08" (null if not a month folder). */
function monthKey_(folderName) {
  const m = folderName.trim().toLowerCase().match(/^([a-z]+)\.?\s+(\d{4})$/)
  if (!m || !MONTHS[m[1].slice(0, 3)]) return null
  return `${m[2]}-${String(MONTHS[m[1].slice(0, 3)]).padStart(2, '0')}`
}

/** Basti files anywhere under each month folder; sub-folder names are kept in the file name. */
function findChangedFiles_() {
  const props = PropertiesService.getScriptProperties()
  const out = []
  const walk = (folder, month, prefix) => {
    const files = folder.getFiles()
    while (files.hasNext()) {
      const file = files.next()
      const fname = file.getName()
      if (!fname.toLowerCase().includes(CONFIG.DISTRICT) || !CONFIG.EXTENSIONS.test(fname)) continue
      const done = Number(props.getProperty(`f_${file.getId()}`) || 0)
      if (done >= file.getLastUpdated().getTime()) continue
      out.push({ file, month, name: prefix + fname.replace(/[\/\\]/g, '_') })
    }
    const subs = folder.getFolders()
    while (subs.hasNext()) {
      const sub = subs.next()
      walk(sub, month, `${prefix}${sub.getName().replace(/[\/\\]/g, '_')}__`)
    }
  }
  const months = DriveApp.getFolderById(CONFIG.SOURCE_FOLDER_ID).getFolders()
  while (months.hasNext()) {
    const folder = months.next()
    const month = monthKey_(folder.getName())
    if (month) walk(folder, month, '')
  }
  return out.sort((a, b) => (a.month + a.name).localeCompare(b.month + b.name))
}

// ---------------------------------------------------------------- GitHub

function github_(method, path, body) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')
  if (!token) throw new Error('GITHUB_TOKEN script property is not set')
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}${path}`, {
    method,
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true,
  })
  const code = res.getResponseCode()
  if (code >= 300) throw new Error(`GitHub ${method.toUpperCase()} ${path} -> ${code}: ${res.getContentText().slice(0, 300)}`)
  return JSON.parse(res.getContentText())
}

/** One commit containing every file exported in this run. */
function commit_(entries, message) {
  const ref = `/git/ref/heads/${CONFIG.GITHUB_BRANCH}`
  const head = github_('get', ref).object.sha
  const baseTree = github_('get', `/git/commits/${head}`).tree.sha
  const tree = github_('post', '/git/trees', { base_tree: baseTree, tree: entries }).sha
  const commit = github_('post', '/git/commits', { message: message.slice(0, 300), tree, parents: [head] }).sha
  github_('patch', `/git/refs/heads/${CONFIG.GITHUB_BRANCH}`, { sha: commit })
  console.log(`committed ${entries.length} file(s): ${commit.slice(0, 7)}`)
}
