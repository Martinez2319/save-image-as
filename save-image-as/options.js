// ═══════════════════════════════════════════════════
// Save image as - Options / Settings
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const askToggle = document.getElementById('askWhereToSave');
  const floatToggle = document.getElementById('enableFloating');
  const status = document.getElementById('downloadError');
  function showError(message) { status.textContent = message || ''; status.hidden = !message; }

  // Cargar configuración guardada
  chrome.storage.local.get(['askWhereToSave', 'enableFloating', 'lastError'], (saved) => {
    if (saved.askWhereToSave !== undefined) askToggle.checked = saved.askWhereToSave;
    if (saved.enableFloating !== undefined) floatToggle.checked = saved.enableFloating;
    showError(saved.lastError);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.lastError) showError(changes.lastError.newValue);
  });

  // Guardar cambios
  askToggle.addEventListener('change', () => {
    chrome.storage.local.set({ askWhereToSave: askToggle.checked });
  });

  floatToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enableFloating: floatToggle.checked });
  });
});
