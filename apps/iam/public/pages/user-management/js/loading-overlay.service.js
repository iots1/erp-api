export function showLoadingOverlay(message = 'กำลังดำเนินการ...') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  const messageEl = document.getElementById('loadingOverlayMessage');
  if (messageEl) messageEl.textContent = message;
  overlay.classList.remove('hidden');
}

export function hideLoadingOverlay() {
  document.getElementById('loadingOverlay')?.classList.add('hidden');
}
