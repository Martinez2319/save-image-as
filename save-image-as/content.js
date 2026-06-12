// ═══════════════════════════════════════════════════════════════════
// Save image as - Content Script (floating element)
// ═══════════════════════════════════════════════════════════════════

let floatingEnabled = false;
let highlightActive = false;

// Cargar configuración
chrome.storage.local.get('enableFloating', (s) => {
  floatingEnabled = !!s.enableFloating;
  if (floatingEnabled) injectFloatingElement();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enableFloating !== undefined) {
    floatingEnabled = !!changes.enableFloating.newValue;
    if (floatingEnabled) {
      injectFloatingElement();
    } else {
      removeFloatingElement();
    }
  }
});

// ─── Inyectar elemento flotante ──────────────────────────────────

let floatingEl = null;

function injectFloatingElement() {
  if (floatingEl || !document.body) return;

  floatingEl = document.createElement('div');
  floatingEl.className = 'sia-float';
  floatingEl.innerHTML = `
    <div class="sia-float-inner">
      <button class="sia-float-toggle" title="Resaltar imágenes">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
      <button class="sia-float-close" title="Desactivar flotante">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(floatingEl);

  // Toggle highlight
  floatingEl.querySelector('.sia-float-toggle').addEventListener('click', toggleHighlight);

  // Cerrar desactiva el flotante permanentemente
  floatingEl.querySelector('.sia-float-close').addEventListener('click', () => {
    chrome.storage.local.set({ enableFloating: false });
    removeFloatingElement();
    if (highlightActive) removeHighlight();
  });
}

function removeFloatingElement() {
  if (floatingEl) {
    floatingEl.remove();
    floatingEl = null;
  }
  if (highlightActive) removeHighlight();
}

// ─── Resaltar imágenes ───────────────────────────────────────────

function toggleHighlight() {
  if (highlightActive) {
    removeHighlight();
  } else {
    applyHighlight();
  }
}

function applyHighlight() {
  highlightActive = true;
  floatingEl?.classList.add('sia-highlight-active');

  // Resaltar imágenes
  document.querySelectorAll('img').forEach((el) => {
    if (el.naturalWidth > 50 && el.naturalHeight > 50) {
      el.classList.add('sia-highlighted');
      el.addEventListener('click', siaMediaClickHandler);
      el.style.cursor = 'pointer';
    }
  });

  // Resaltar videos
  document.querySelectorAll('video').forEach((el) => {
    const hasSrc = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src');
    if (hasSrc) {
      el.classList.add('sia-highlighted');
      el.addEventListener('click', siaMediaClickHandler);
      el.style.cursor = 'pointer';
    }
  });
}

function removeHighlight() {
  highlightActive = false;
  floatingEl?.classList.remove('sia-highlight-active');
  document.querySelectorAll('.sia-highlighted').forEach((el) => {
    el.classList.remove('sia-highlighted');
    el.removeEventListener('click', siaMediaClickHandler);
    el.style.cursor = '';
  });
}

function siaMediaClickHandler(e) {
  e.stopPropagation();
  e.preventDefault();

  const el = e.currentTarget;
  const tag = el.tagName.toLowerCase();
  let url = '';

  if (tag === 'img') {
    url = el.getAttribute('src') || '';
  } else if (tag === 'video') {
    url = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || '';
  }

  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;

  chrome.runtime.sendMessage({
    action: 'downloadOriginal',
    imageUrl: url,
    isVideo: tag === 'video'
  });

  // Feedback visual
  el.style.outline = '3px solid #00c853';
  setTimeout(() => { el.style.outline = ''; }, 1000);
}
