// ═══════════════════════════════════════════════════════════════════
// Save image as PDF, PNG, JPG, WebP - Service Worker
// ═══════════════════════════════════════════════════════════════════

const FORMATS = {
  pdf:  { label: 'PDF',  mime: 'image/jpeg', ext: '.pdf',  quality: 0.92, imageOnly: true },
  png:  { label: 'PNG',  mime: 'image/png',  ext: '.png',  quality: null,  imageOnly: true },
  jpg:  { label: 'JPG',  mime: 'image/jpeg', ext: '.jpg',  quality: 0.92, imageOnly: true },
  webp: { label: 'WebP', mime: 'image/webp', ext: '.webp', quality: 0.85, imageOnly: true },
  mp4:  { label: 'MP4',  mime: 'video/mp4',  ext: '.mp4',  quality: null,  imageOnly: false },
  webm: { label: 'WebM', mime: 'video/webm', ext: '.webm', quality: null,  imageOnly: false }
};

const PARENT_ID = 'save-image-as-parent';
const VIDEO_PARENT_ID = 'save-video-as-parent';

// ─── Estado ──────────────────────────────────────────────────────

let settings = { askWhereToSave: false };

chrome.storage.local.get('askWhereToSave', (s) => {
  settings.askWhereToSave = !!s.askWhereToSave;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.askWhereToSave) settings.askWhereToSave = !!changes.askWhereToSave.newValue;
});

// ─── Menú contextual ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Menú para imágenes
    chrome.contextMenus.create({
      id: PARENT_ID,
      title: 'Save image as...',
      contexts: ['image']
    });
    Object.entries(FORMATS).forEach(([key, fmt]) => {
      chrome.contextMenus.create({
        id: 'img_' + key,
        parentId: PARENT_ID,
        title: `Save as ${fmt.label}`,
        contexts: ['image']
      });
    });

    // Menú para videos
    chrome.contextMenus.create({
      id: VIDEO_PARENT_ID,
      title: 'Save video as...',
      contexts: ['video']
    });
    ['mp4', 'webm'].forEach((key) => {
      chrome.contextMenus.create({
        id: 'vid_' + key,
        parentId: VIDEO_PARENT_ID,
        title: `Save as ${FORMATS[key].label}`,
        contexts: ['video']
      });
    });
  });
}

// ─── Conversión de formato ───────────────────────────────────────

async function fetchImageAsBlob(imageUrl) {
  const resp = await fetch(imageUrl, {
    mode: 'cors',
    cache: 'force-cache',
    headers: { 'Accept': 'image/*' }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.blob();
}

async function convertWithOffscreenCanvas(imageBlob, formatKey) {
  const fmt = FORMATS[formatKey];
  if (!fmt) throw new Error(`Unknown format: ${formatKey}`);

  const imgBitmap = await createImageBitmap(imageBlob);

  const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  ctx.drawImage(imgBitmap, 0, 0);

  // Para PDF necesitamos un paso extra
  if (formatKey === 'pdf') {
    const jpegBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.92
    });
    const jpegArrayBuf = await jpegBlob.arrayBuffer();
    const pdfBlob = createPdfFromJpeg(new Uint8Array(jpegArrayBuf), imgBitmap.width, imgBitmap.height);
    return { blob: pdfBlob, ext: '.pdf' };
  }

  const blob = await canvas.convertToBlob({
    type: fmt.mime,
    quality: fmt.quality ?? undefined
  });

  return { blob, ext: fmt.ext };
}

// ─── Generación de PDF mínimo ────────────────────────────────────

function createPdfFromJpeg(jpegData, width, height) {
  return buildPdfBinary(jpegData, Math.round(width), Math.round(height));
}

function buildPdfBinary(jpegData, width, height) {
  const w = width;
  const h = height;
  const jpegLen = jpegData.byteLength;

  const contentStream = `q\n${w} 0 0 ${h} 0 0 cm\n/Img1 Do\nQ\n`;
  const contentStreamLen = contentStream.length;

  // Build all objects as strings first
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /XObject << /Img1 5 0 R >> >> >>\nendobj\n`;
  const obj4 = `4 0 obj\n<< /Length ${contentStreamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegLen} >>\nstream\n`;

  const header = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';

  // Calculate offsets
  let offset = header.length;
  const offsets = [];
  offsets.push(offset); obj1; // 1
  offset += new TextEncoder().encode(obj1).length;
  offsets.push(offset); // 2
  offset += new TextEncoder().encode(obj2).length;
  offsets.push(offset); // 3
  offset += new TextEncoder().encode(obj3).length;
  offsets.push(offset); // 4
  offset += new TextEncoder().encode(obj4).length;
  offsets.push(offset); // 5 header
  offset += new TextEncoder().encode(obj5Header).length;
  offsets.push(offset); // jpeg data start
  offset += jpegLen;
  const endstreamEndobj = '\nendstream\nendobj\n';
  offset += new TextEncoder().encode(endstreamEndobj).length;

  // Xref
  const xrefOffset = offset;
  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offsets[0]).padStart(10, '0')} 00000 n \n${String(offsets[1]).padStart(10, '0')} 00000 n \n${String(offsets[2]).padStart(10, '0')} 00000 n \n${String(offsets[3]).padStart(10, '0')} 00000 n \n${String(offsets[4]).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Combine everything as bytes
  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(header),
    encoder.encode(obj1),
    encoder.encode(obj2),
    encoder.encode(obj3),
    encoder.encode(obj4),
    encoder.encode(obj5Header),
    jpegData,
    encoder.encode(endstreamEndobj),
    encoder.encode(xref)
  ];

  const totalLen = parts.reduce((s, p) => s + p.byteLength, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.byteLength;
  }

  return new Blob([result], { type: 'application/pdf' });
}

// ─── Handler para downloadOriginal desde content.js ──────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadOriginal') {
    const url = request.imageUrl;
    if (!url || url.startsWith('data:')) { sendResponse({ success: false }); return; }
    const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
    chrome.downloads.download({
      url,
      filename,
      saveAs: settings.askWhereToSave,
      conflictAction: 'uniquify'
    }, (id) => {
      sendResponse({ success: !chrome.runtime.lastError, downloadId: id });
    });
    return true; // keep channel open
  }
});

// ─── Manejo de clics en el menú ─────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.srcUrl) return;
  const menuItemId = String(info.menuItemId);

  // Determinar si es imagen o video y extraer el format key
  let formatKey;
  let isVideo = menuItemId.startsWith('vid_');

  if (menuItemId === PARENT_ID || menuItemId === VIDEO_PARENT_ID) return;
  if (menuItemId.startsWith('img_')) {
    formatKey = menuItemId.replace('img_', '');
  } else if (menuItemId.startsWith('vid_')) {
    formatKey = menuItemId.replace('vid_', '');
  } else return;

  if (!FORMATS[formatKey]) return;

  const mediaUrl = info.srcUrl;
  updateBadge(tab?.id, '...');

  try {
    if (isVideo) {
      // Videos: descargar directamente sin conversión
      const filename = generateFilename(mediaUrl, formatKey, true);
      chrome.downloads.download({
        url: mediaUrl,
        filename,
        saveAs: settings.askWhereToSave,
        conflictAction: 'uniquify'
      });
      clearBadge(tab?.id);
    } else {
      // Imágenes: convertir con OffscreenCanvas
      const filename = generateFilename(mediaUrl, formatKey);
      const imageBlob = await fetchImageAsBlob(mediaUrl);
      const { blob } = await convertWithOffscreenCanvas(imageBlob, formatKey);

      const downloadOptions = {
        url: URL.createObjectURL(blob),
        filename,
        saveAs: settings.askWhereToSave,
        conflictAction: 'uniquify'
      };

      chrome.downloads.download(downloadOptions, () => {
        if (chrome.runtime.lastError) {
          console.error('[Save image as] Error:', chrome.runtime.lastError.message);
        }
        setTimeout(() => URL.revokeObjectURL(downloadOptions.url), 5000);
        clearBadge(tab?.id);
      });
    }
  } catch (err) {
    console.error('[Save media as] Error:', err);
    // Fallback: descargar original
    chrome.downloads.download({
      url: mediaUrl,
      filename: isVideo ? `video${FORMATS[formatKey].ext}` : `image${FORMATS[formatKey].ext}`,
      saveAs: settings.askWhereToSave,
      conflictAction: 'uniquify'
    });
    clearBadge(tab?.id);
  }
});

// ─── Utilidades ──────────────────────────────────────────────────

function generateFilename(mediaUrl, formatKey, isVideo) {
  const ext = FORMATS[formatKey].ext;
  const fallback = isVideo ? 'video' : 'image';
  try {
    const url = new URL(mediaUrl);
    const path = url.pathname;
    const name = path.split('/').pop()?.split('?')[0] || fallback;
    const baseName = name.replace(/\.[^.]+$/, '') || fallback;
    return `${baseName}${ext}`;
  } catch {
    return `${fallback}_${Date.now()}${ext}`;
  }
}

function updateBadge(tabId, text) {
  if (!tabId) return;
  try {
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#0095f6', tabId });
  } catch { /* ignore */ }
}

function clearBadge(tabId) {
  if (!tabId) return;
  try { chrome.action.setBadgeText({ text: '', tabId }); } catch { /* ignore */ }
}
