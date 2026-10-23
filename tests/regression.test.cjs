const test = require('node:test');
const assert = require('node:assert/strict');
const { background, content, jpeg } = require('./helpers.cjs');

test('PDF startxref and every object point to their actual byte offsets', async () => {
  const app = background(); app.context.jpeg = jpeg;
  const bytes = Buffer.from(await app.run('buildPdfBinary(jpeg, 4, 3)').arrayBuffer());
  const text = bytes.toString('latin1');
  const offset = Number(/startxref\s+(\d+)/.exec(text)[1]);
  assert.equal(bytes.subarray(offset, offset + 4).toString(), 'xref');
  const entries = text.slice(offset).split('\n').slice(3, 8);
  entries.forEach((entry, index) => assert.equal(bytes.subarray(Number(entry.slice(0, 10)), Number(entry.slice(0, 10)) + 7).toString(), `${index + 1} 0 obj`));
  assert.ok(bytes.includes(jpeg));
});
test('PDF rejects invalid dimensions', () => assert.throws(() => background().run('buildPdfBinary(new Uint8Array(), 0, 2)')));
test('image menu contains only supported encoders and explicit original download', () => {
  const app = background(); app.run('createContextMenu()');
  assert.deepEqual(app.menus.filter(item => item.parentId === 'save-image-as-parent').map(item => item.id), ['img_pdf', 'img_png', 'img_jpg', 'img_webp', 'img_original']);
});
test('video menu offers only original download', () => {
  const app = background(); app.run('createContextMenu()');
  assert.deepEqual(app.menus.filter(item => item.parentId === 'save-video-as-parent').map(item => item.id), ['vid_original']);
});
test('failed conversion reports an error without downloading mislabeled original bytes', async () => {
  const app = background({ fetchError: true }); await app.click('img_pdf', 'https://example.test/photo.png');
  assert.equal(app.downloads.length, 0); assert.match(app.saved.lastError, /network failure/); assert.equal(app.badges.at(-1).text, '!');
});
test('WebM original is handed to the browser with no forced MP4 filename', async () => {
  const app = background(); await app.click('vid_original', 'https://example.test/clip.webm');
  assert.equal(app.downloads[0].url, 'https://example.test/clip.webm'); assert.equal(Object.hasOwn(app.downloads[0], 'filename'), false);
});
test('unsupported legacy video encoder IDs are ignored', async () => {
  const app = background(); await app.click('vid_mp4', 'https://example.test/clip.webm'); await app.click('img_mp4', 'https://example.test/photo.png');
  assert.equal(app.downloads.length, 0);
});
test('PNG fallback from a missing WebP encoder is rejected and bitmap is closed', async () => {
  const app = background({ mime: 'image/png' });
  await assert.rejects(app.run('convertWithOffscreenCanvas(new Blob(), "webp")'), /codificar/); assert.equal(app.closed, 1);
});
test('PDF requires actual JPEG bytes from the canvas encoder', async () => {
  const app = background({ mime: 'image/png' }); await assert.rejects(app.run('convertWithOffscreenCanvas(new Blob(), "pdf")'), /codificar/);
});
test('successful conversion preserves requested MIME and extension', async () => {
  const app = background(); const result = await app.run('convertWithOffscreenCanvas(new Blob(), "webp")');
  assert.equal(result.blob.type, 'image/webp'); assert.equal(result.ext, '.webp'); assert.equal(app.closed, 1);
});
test('converted object URL lives until the download completes', async () => {
  const app = background(); await app.click('img_png', 'https://example.test/photo.jpg');
  assert.equal(app.revoked.length, 0); assert.equal(app.downloads[0].filename, 'photo.png');
  app.changed(1, 'complete'); assert.deepEqual(app.revoked, ['blob:test/0']); assert.equal(app.badges.at(-1).text, '');
});
test('interrupted download releases the object URL and reports failure', async () => {
  const app = background(); await app.click('img_pdf', 'https://example.test/photo.jpg'); app.changed(1, 'interrupted');
  assert.equal(app.revoked.length, 1); assert.match(app.saved.lastError, /interrump/);
});
test('download creation failure releases the object URL and shows failure', async () => {
  const app = background({ downloadError: true }); await app.click('img_png', 'https://example.test/photo.jpg');
  assert.equal(app.revoked.length, 1); assert.match(app.saved.lastError, /denied/);
});
test('already completed downloads are cleaned up by the immediate state query', async () => {
  const app = background({ initialState: 'complete' }); await app.click('img_png', 'https://example.test/photo.jpg'); assert.equal(app.revoked.length, 1);
});
test('save-as preference is passed to downloads', async () => {
  const app = background({ settings: { askWhereToSave: true } }); await app.click('vid_original', 'https://example.test/video.webm'); assert.equal(app.downloads[0].saveAs, true);
});
test('background resolves relative message URLs against the sender page', async () => {
  const app = background(); const response = await app.message({ action: 'downloadOriginal', imageUrl: '/media/a.png' });
  assert.equal(response.success, true); assert.equal(app.downloads[0].url, 'https://example.test/media/a.png');
});
test('missing or blob URLs are rejected with a failed message response', async () => {
  const app = background();
  for (const value of ['', undefined, 'blob:https://example.test/id']) assert.equal((await app.message({ action: 'downloadOriginal', imageUrl: value })).success, false);
  assert.equal(app.downloads.length, 0);
});
test('converted filenames are safe relative basenames', () => {
  const app = background(); assert.equal(app.run('generateFilename("https://example.test/a%2Fb%3F.jpg", "png")'), 'a_b_.png');
  assert.equal(app.run('generateFilename("data:image/png;base64,AAAA", "pdf")'), 'image.pdf');
});
test('floating image click resolves relative source against document baseURI', () => {
  const app = content({ tagName: 'IMG', getAttribute: () => '../photo.png' }); app.run('siaMediaClickHandler(event)');
  assert.equal(app.request.imageUrl, 'https://example.test/photo.png'); assert.equal(app.counters.prevented, 1);
});
test('floating images respect the currentSrc selected from srcset', () => {
  const app = content({ tagName: 'IMG', currentSrc: 'https://cdn.example.test/high.jpg', src: 'https://example.test/low.jpg' });
  app.run('siaMediaClickHandler(event)'); assert.equal(app.request.imageUrl, 'https://cdn.example.test/high.jpg');
});
test('floating videos prefer selected currentSrc over the first source', () => {
  const app = content({ tagName: 'VIDEO', currentSrc: 'https://example.test/selected.webm', querySelector: () => ({ src: 'https://example.test/unused.mp4' }) });
  app.run('siaMediaClickHandler(event)'); assert.equal(app.request.imageUrl, 'https://example.test/selected.webm');
});
test('unsupported floating media leave normal page clicks alone', () => {
  const app = content({ tagName: 'IMG', currentSrc: 'blob:https://example.test/image', src: '', getAttribute: () => '' });
  app.run('siaMediaClickHandler(event)'); assert.equal(app.request, undefined); assert.equal(app.counters.prevented, 0);
});
test('floating feedback uses failure response instead of unconditional success', () => {
  const app = content({ tagName: 'IMG', src: 'https://example.test/photo.png' }, { response: { success: false, error: 'denied' } });
  app.run('siaMediaClickHandler(event)'); assert.equal(app.classes.has('sia-download-error'), true); assert.equal(app.classes.has('sia-download-success'), false);
});
