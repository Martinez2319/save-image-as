// Firefox uses the background event page declared in manifest.json.
const FORMATS = {
  pdf: { label: 'PDF', mime: 'image/jpeg', ext: '.pdf', quality: 0.92 },
  png: { label: 'PNG', mime: 'image/png', ext: '.png' },
  jpg: { label: 'JPG', mime: 'image/jpeg', ext: '.jpg', quality: 0.92 },
  webp: { label: 'WebP', mime: 'image/webp', ext: '.webp', quality: 0.85 }
};
const PARENT_ID = 'save-image-as-parent';
const VIDEO_PARENT_ID = 'save-video-as-parent';
const pendingDownloads = new Map();
let settings = { askWhereToSave: false };
const settingsReady = new Promise((resolve) => {
  chrome.storage.local.get('askWhereToSave', (saved) => {
    settings.askWhereToSave = !!saved.askWhereToSave;
    resolve();
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.askWhereToSave) settings.askWhereToSave = !!changes.askWhereToSave.newValue;
});
chrome.runtime.onInstalled.addListener(createContextMenu);

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: PARENT_ID, title: 'Guardar imagen como…', contexts: ['image'] });
    for (const [key, format] of Object.entries(FORMATS)) {
      chrome.contextMenus.create({ id: 'img_' + key, parentId: PARENT_ID, title: 'Guardar como ' + format.label, contexts: ['image'] });
    }
    chrome.contextMenus.create({ id: 'img_original', parentId: PARENT_ID, title: 'Descargar original', contexts: ['image'] });
    chrome.contextMenus.create({ id: VIDEO_PARENT_ID, title: 'Guardar video…', contexts: ['video'] });
    chrome.contextMenus.create({ id: 'vid_original', parentId: VIDEO_PARENT_ID, title: 'Descargar original (sin convertir)', contexts: ['video'] });
  });
}

async function fetchImageAsBlob(url) {
  const response = await fetch(url, { mode: 'cors', cache: 'force-cache', headers: { Accept: 'image/*' } });
  if (!response.ok) throw new Error('No se pudo obtener la imagen (HTTP ' + response.status + ').');
  return response.blob();
}

async function convertWithOffscreenCanvas(imageBlob, formatKey) {
  if (!Object.hasOwn(FORMATS, formatKey)) throw new Error('Formato de imagen no admitido.');
  const format = FORMATS[formatKey];
  if (!format) throw new Error('Formato de imagen no admitido.');
  const bitmap = await createImageBitmap(imageBlob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo crear el lienzo de conversión.');
    if (format.mime === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, bitmap.width, bitmap.height);
    }
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: format.mime, quality: format.quality });
    if (blob.type.toLowerCase() !== format.mime) throw new Error('El navegador no pudo codificar el formato ' + format.label + '.');
    if (formatKey === 'pdf') {
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      return { blob: buildPdfBinary(jpeg, bitmap.width, bitmap.height), ext: format.ext };
    }
    return { blob, ext: format.ext };
  } finally { bitmap.close(); }
}

function buildPdfBinary(jpegData, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Dimensiones de imagen inválidas.');
  const encoder = new TextEncoder();
  const content = encoder.encode(`q\n${width} 0 0 ${height} 0 0 cm\n/Img1 Do\nQ\n`);
  const parts = [encoder.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')];
  const offsets = [];
  let offset = parts[0].byteLength;
  function addObject(number, chunks) {
    offsets.push(offset);
    for (const chunk of [encoder.encode(`${number} 0 obj\n`), ...chunks, encoder.encode('\nendobj\n')]) {
      parts.push(chunk); offset += chunk.byteLength;
    }
  }
  addObject(1, [encoder.encode('<< /Type /Catalog /Pages 2 0 R >>')]);
  addObject(2, [encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')]);
  addObject(3, [encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Img1 5 0 R >> >> >>`)]);
  addObject(4, [encoder.encode(`<< /Length ${content.byteLength} >>\nstream\n`), content, encoder.encode('\nendstream')]);
  addObject(5, [encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegData.byteLength} >>\nstream\n`), jpegData, encoder.encode('\nendstream')]);
  const xref = offsets.map(position => String(position).padStart(10, '0') + ' 00000 n \n').join('');
  parts.push(encoder.encode(`xref\n0 6\n0000000000 65535 f \n${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return new Blob(parts, { type: 'application/pdf' });
}

function generateFilename(mediaUrl, formatKey) {
  if (!Object.hasOwn(FORMATS, formatKey)) throw new Error('Formato de imagen no admitido.');
  const format = FORMATS[formatKey];
  if (!format) throw new Error('Formato de imagen no admitido.');
  let base = 'image';
  try {
    const url = new URL(mediaUrl);
    if (['http:', 'https:', 'file:'].includes(url.protocol)) {
      const name = url.pathname.split('/').pop();
      if (name) { try { base = decodeURIComponent(name); } catch { base = name; } }
    }
  } catch { /* Use the generic image name for non-URL inputs. */ }
  base = base.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || 'image';
  return base + format.ext;
}

function originalUrl(url, base) {
  if (typeof url !== 'string' || !url.trim()) throw new Error('No se encontró una URL de medio válida.');
  const resolved = base ? new URL(url, base) : new URL(url);
  if (!['http:', 'https:', 'file:'].includes(resolved.protocol)) throw new Error('Este medio no tiene una URL descargable. Los streams blob no se convierten en archivos de video.');
  return resolved.href;
}
function showError(tabId, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Save image as]', message);
  chrome.storage.local.set({ lastError: message });
  setBadge(tabId, '!', '#c62828', 'Error: ' + message);
}
function setBadge(tabId, text, color = '#0095f6', title = 'Save image as…') {
  if (tabId == null) return;
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setTitle({ tabId, title });
}

function finishDownload(id, state) {
  const pending = pendingDownloads.get(id);
  if (!pending || !['complete', 'interrupted'].includes(state)) return;
  pendingDownloads.delete(id);
  if (pending.objectUrl) URL.revokeObjectURL(pending.objectUrl);
  if (state === 'interrupted') showError(pending.tabId, new Error('La descarga se interrumpió o fue cancelada.'));
  else setBadge(pending.tabId, '');
}
chrome.downloads.onChanged.addListener(delta => finishDownload(delta.id, delta.state?.current));

async function startDownload(options, tabId, objectUrl) {
  await settingsReady;
  try {
    const id = await new Promise((resolve, reject) => {
      chrome.downloads.download({ ...options, saveAs: settings.askWhereToSave, conflictAction: 'uniquify' }, (downloadId) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!Number.isInteger(downloadId)) reject(new Error('No se pudo iniciar la descarga.'));
        else resolve(downloadId);
      });
    });
    pendingDownloads.set(id, { tabId, objectUrl });
    setBadge(tabId, '↓');
    // The download may have completed before its creation callback ran.
    chrome.downloads.search({ id }, items => {
      if (!chrome.runtime.lastError && items[0]) finishDownload(id, items[0].state);
    });
    return id;
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function downloadOriginal(url, tabId, base) {
  // Omit filename: let Firefox honor the original URL, MIME and Content-Disposition.
  return startDownload({ url: originalUrl(url, base) }, tabId);
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'downloadOriginal') return undefined;
  chrome.storage.local.set({ lastError: '' });
  downloadOriginal(request.imageUrl, sender.tab?.id, sender.url).then(
    id => sendResponse({ success: true, downloadId: id }),
    error => { showError(sender.tab?.id, error); sendResponse({ success: false, error: error.message }); }
  );
  return true;
});

async function handleMenuClick(info, tab) {
  if (!info.srcUrl) return;
  const key = String(info.menuItemId);
  if (key !== 'vid_original' && key !== 'img_original' && !(key.startsWith('img_') && Object.hasOwn(FORMATS, key.slice(4)))) return;
  chrome.storage.local.set({ lastError: '' });
  setBadge(tab?.id, '…');
  try {
    if (key === 'vid_original' || key === 'img_original') {
      await downloadOriginal(info.srcUrl, tab?.id);
    } else {
      const format = key.slice(4);
      const image = await fetchImageAsBlob(info.srcUrl);
      const { blob } = await convertWithOffscreenCanvas(image, format);
      const objectUrl = URL.createObjectURL(blob);
      await startDownload({ url: objectUrl, filename: generateFilename(info.srcUrl, format) }, tab?.id, objectUrl);
    }
  } catch (error) {
    showError(tab?.id, new Error(error.message + ' Puedes usar «Descargar original» si la URL es accesible.'));
  }
}
chrome.contextMenus.onClicked.addListener(handleMenuClick);
