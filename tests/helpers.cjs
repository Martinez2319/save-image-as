const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const folder = path.join(__dirname, '..', 'save-image-as');
const jpeg = fs.readFileSync(path.join(__dirname, 'fixtures', 'image.jpg'));
function background(options = {}) {
  const downloads = [], menus = [], revoked = [], blobs = new Map(), saved = {}, badges = [];
  let click, message, changed;
  const chrome = {
    storage: { local: { get(_, fn) { fn(options.settings || {}); }, set(value) { Object.assign(saved, value); } }, onChanged: { addListener() {} } },
    runtime: { onInstalled: { addListener() {} }, onMessage: { addListener(fn) { message = fn; } } },
    contextMenus: { removeAll(fn) { fn(); }, create(item) { menus.push(item); }, onClicked: { addListener(fn) { click = fn; } } },
    downloads: {
      download(value, fn) { downloads.push(value); if (options.downloadError) chrome.runtime.lastError = { message: 'denied' }; fn(downloads.length); delete chrome.runtime.lastError; },
      onChanged: { addListener(fn) { changed = fn; } },
      search(_, fn) { fn([{ state: options.initialState || 'in_progress' }]); }
    },
    action: { setBadgeText(value) { badges.push(value); }, setBadgeBackgroundColor() {}, setTitle() {} }
  };
  class MockURL extends URL {
    static createObjectURL(blob) { const url = 'blob:test/' + blobs.size; blobs.set(url, blob); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  let closed = 0;
  class Canvas {
    getContext() { return options.noContext ? null : { drawImage() {}, fillRect() {} }; }
    async convertToBlob(value) { return new Blob([jpeg], { type: options.mime || value.type }); }
  }
  const context = vm.createContext({
    chrome, Blob, TextEncoder, Uint8Array, URL: MockURL,
    console: { error() {} }, OffscreenCanvas: Canvas,
    createImageBitmap: async () => ({ width: 4, height: 3, close() { closed++; } }),
    fetch: async () => { if (options.fetchError) throw new Error('network failure'); return { ok: true, blob: async () => new Blob([jpeg], { type: 'image/jpeg' }) }; }
  });
  vm.runInContext(fs.readFileSync(path.join(folder, 'background.js'), 'utf8'), context);
  return { context, downloads, menus, revoked, blobs, saved, badges, get closed() { return closed; },
    run: (code) => vm.runInContext(code, context), click: (id, url) => click({ menuItemId: id, srcUrl: url }, { id: 0 }),
    changed: (id, state) => changed({ id, state: { current: state } }),
    message: (request, sender = { tab: { id: 0 }, url: 'https://example.test/page' }) => new Promise(resolve => message(request, sender, resolve))
  };
}
function content(element, options = {}) {
  let request;
  const classes = new Set(), counters = { prevented: 0, stopped: 0 };
  element.classList = { add(value) { classes.add(value); }, remove(value) { classes.delete(value); } };
  const context = vm.createContext({
    URL, console: { warn() {} }, setTimeout() {},
    chrome: { storage: { local: { get(_, fn) { fn({}); } }, onChanged: { addListener() {} } }, runtime: { sendMessage(value, fn) { request = value; fn(options.response || { success: true }); } } },
    document: { baseURI: 'https://example.test/articles/' }
  });
  vm.runInContext(fs.readFileSync(path.join(folder, 'content.js'), 'utf8'), context);
  context.element = element;
  context.event = { currentTarget: element, preventDefault() { counters.prevented++; }, stopPropagation() { counters.stopped++; } };
  return { run: code => vm.runInContext(code, context), get request() { return request; }, counters, classes };
}
module.exports = { background, content, jpeg };
