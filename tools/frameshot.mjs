#!/usr/bin/env node
// Frameshot command-line renderer.
//
// Drives index.html in a headless browser through its window.frameshot API,
// so an agent (or a script) can turn a JSON shot list into PNG stills and an
// MP4 video without touching the UI.
//
//   node tools/frameshot.mjs describe <model>
//   node tools/frameshot.mjs stills   <shots.json> [--out dir]
//   node tools/frameshot.mjs render   <shots.json> [--out dir] [--no-stills] [--no-video]
//
// Every command prints one JSON object to stdout. On failure it prints
// { "ok": false, "error": "..." } and exits with code 1.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Stage sizes in CSS pixels. Caption sizes scale with the stage width,
// so fixed sizes keep results consistent between runs.
const FRAMES = {
  landscape: { width: 1600, height: 900 },  // 16:9
  portrait: { width: 720, height: 1280 },   // 9:16, for Reels, Shorts, TikTok
  square: { width: 1080, height: 1080 },    // 1:1
};

const USAGE = `Usage:
  node tools/frameshot.mjs describe <model>
  node tools/frameshot.mjs stills   <shots.json> [--out dir]
  node tools/frameshot.mjs render   <shots.json> [--out dir] [--no-stills] [--no-video]

Options:
  --out <dir>     Output folder (default: the shot list's "output.dir", or ./frameshot-out)
  --model <file>  Use this model instead of the shot list's "model"
  --headed        Show the browser window
  --verbose       Print the page's console messages to stderr`;

class CliError extends Error {}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (['out', 'model'].includes(key)) args.flags[key] = argv[++i];
      else args.flags[key] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg',
};

// Serves the tool from the repo, and the model's folder under /__model/
// so a .gltf's companion files resolve next to it.
function startServer(modelDir) {
  const server = http.createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (url.startsWith('/__model/') && modelDir) file = path.join(modelDir, url.slice('/__model/'.length));
    else file = path.join(ROOT, url === '/' ? 'index.html' : url);
    const base = url.startsWith('/__model/') ? modelDir : ROOT;
    if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launchBrowser(headed) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new CliError('Playwright isn’t installed. Run: npm install && npx playwright install chromium');
  }
  // Use the GPU when there is one. On machines without a GPU (CI, servers)
  // set FRAMESHOT_SOFTWARE_GL=1 to render with SwiftShader instead.
  const args = process.env.FRAMESHOT_SOFTWARE_GL
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--ignore-gpu-blocklist'];
  // Prefer installed Google Chrome: it can encode H.264. Playwright's own
  // Chromium can't, so videos from it fall back to VP9 (still .mp4).
  try {
    return await playwright.chromium.launch({ channel: 'chrome', headless: !headed, args });
  } catch {
    try {
      return await playwright.chromium.launch({ headless: !headed, args });
    } catch (e) {
      throw new CliError(`Couldn’t start a browser. Run: npx playwright install chromium\n${e.message}`);
    }
  }
}

// Run fn(page) with the tool open at the given frame size and model served.
async function withPage({ modelPath, frame, headed, verbose }, fn) {
  const modelDir = modelPath ? path.dirname(path.resolve(modelPath)) : null;
  const server = await startServer(modelDir);
  const browser = await launchBrowser(headed);
  try {
    const size = typeof frame === 'object' ? frame : FRAMES[frame || 'landscape'];
    if (!size || !size.width || !size.height) {
      throw new CliError(`Unknown frame “${JSON.stringify(frame)}”. Use landscape, portrait, square or { "width": …, "height": … }.`);
    }
    const page = await browser.newPage({ viewport: size, acceptDownloads: true });
    if (verbose) page.on('console', (m) => process.stderr.write(`[page] ${m.text()}\n`));
    page.on('pageerror', (e) => process.stderr.write(`[page error] ${e.message}\n`));
    // Don't wait for the full load event: the API signals readiness itself.
    await page.goto(`http://127.0.0.1:${server.address().port}/?fresh`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.frameshot, null, { timeout: 30000 }).catch(() => {
      throw new CliError('The page loaded, but window.frameshot never appeared. Check the network can reach cdn.jsdelivr.net (three.js is loaded from there).');
    });
    await page.evaluate(() => window.frameshot.ready);
    // The UI chrome isn't part of images or video, but hide it anyway so
    // headed runs show just the stage.
    await page.addStyleTag({ content: '.header,.dock,.sequence,.seq-reopen,.author-panel,.toast{display:none!important}' });
    let description = null;
    if (modelPath) {
      const url = '/__model/' + encodeURIComponent(path.basename(modelPath));
      description = await call(page, (u) => window.frameshot.loadModel(u), url);
    }
    return await fn(page, description);
  } finally {
    await browser.close();
    server.close();
  }
}

// Evaluate in the page, turning FrameshotError into a readable CliError.
async function call(page, fn, arg) {
  try {
    return await page.evaluate(fn, arg);
  } catch (e) {
    const msg = String(e.message || e).replace(/^.*?Error: /s, '').split('\n')[0];
    throw new CliError(msg);
  }
}

async function readShots(file, flags) {
  let shots;
  try {
    shots = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    throw new CliError(`Couldn’t read the shot list ${file}: ${e.message}`);
  }
  // A bare array is a views file exported from the UI; it needs --model.
  if (Array.isArray(shots)) shots = { views: shots };
  const baseDir = path.dirname(path.resolve(file));
  const model = flags.model || (shots.model && path.resolve(baseDir, shots.model));
  if (!model) throw new CliError('No model given. Add "model": "path/to/model.glb" to the shot list, or pass --model.');
  try { await fs.access(model); } catch { throw new CliError(`Model file not found: ${model}`); }
  if (!Array.isArray(shots.views) || !shots.views.length) throw new CliError('The shot list has no "views".');
  const out = path.resolve(flags.out || (shots.output && shots.output.dir && path.resolve(baseDir, shots.output.dir)) || 'frameshot-out');
  return { shots, model, out };
}

async function writeStills(page, shots, out) {
  const stills = [];
  const scale = (shots.output && shots.output.stillScale) || 1;
  const background = shots.background || '#000';
  for (let i = 0; i < shots.views.length; i++) {
    const img = await call(page, (o) => window.frameshot.takeImage(o), { view: i, captions: true, background, scale });
    const file = path.join(out, `still-${String(i + 1).padStart(2, '0')}.png`);
    await fs.writeFile(file, Buffer.from(img.dataUrl.split(',')[1], 'base64'));
    stills.push({ view: i, caption: shots.views[i].caption || null, file, width: img.width, height: img.height });
  }
  return stills;
}

async function writeVideo(page, shots, out) {
  const name = (shots.output && shots.output.videoName) || 'sequence.mp4';
  const longEdge = (shots.output && shots.output.longEdge) || 1920;
  const [download, meta] = await Promise.all([
    page.waitForEvent('download', { timeout: 0 }),
    call(page, (o) => window.frameshot.exportVideo(o), { download: true, fileName: name, longEdge }),
  ]);
  const file = path.join(out, name);
  await download.saveAs(file);
  return { file, ...meta };
}

async function main() {
  const { _: [command, target], flags } = parseArgs(process.argv.slice(2));
  if (!command || flags.help || !['describe', 'stills', 'render'].includes(command) || !target) {
    console.error(USAGE);
    process.exit(command && !flags.help ? 1 : 0);
  }
  const common = { headed: !!flags.headed, verbose: !!flags.verbose };

  if (command === 'describe') {
    const model = path.resolve(target);
    try { await fs.access(model); } catch { throw new CliError(`Model file not found: ${model}`); }
    const description = await withPage({ ...common, modelPath: model }, async (_page, d) => d);
    return { ok: true, model: description };
  }

  const { shots, model, out } = await readShots(target, flags);
  await fs.mkdir(out, { recursive: true });
  const wantStills = command === 'stills' || !flags['no-stills'];
  const wantVideo = command === 'render' && !flags['no-video'];

  return withPage({ ...common, modelPath: model, frame: shots.frame }, async (page, description) => {
    await call(page, (views) => window.frameshot.setViews(views), shots.views);
    const result = { ok: true, model: description, out };
    if (wantStills) result.stills = await writeStills(page, shots, out);
    if (wantVideo) result.video = await writeVideo(page, shots, out);
    return result;
  });
}

main().then(
  (result) => { console.log(JSON.stringify(result, null, 2)); },
  (e) => {
    console.log(JSON.stringify({ ok: false, error: e instanceof CliError ? e.message : String(e.stack || e) }, null, 2));
    process.exit(1);
  },
);
