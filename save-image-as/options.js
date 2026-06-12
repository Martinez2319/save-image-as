// ═══════════════════════════════════════════════════
// Save image as - Options / Settings
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const askToggle = document.getElementById('askWhereToSave');
  const floatToggle = document.getElementById('enableFloating');

  // Cargar configuración guardada
  chrome.storage.local.get(['askWhereToSave', 'enableFloating'], (saved) => {
    if (saved.askWhereToSave !== undefined) askToggle.checked = saved.askWhereToSave;
    if (saved.enableFloating !== undefined) floatToggle.checked = saved.enableFloating;
  });

  // Guardar cambios
  askToggle.addEventListener('change', () => {
    chrome.storage.local.set({ askWhereToSave: askToggle.checked });
  });

  floatToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enableFloating: floatToggle.checked });
  });
});
