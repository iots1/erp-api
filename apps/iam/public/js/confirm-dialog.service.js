// Reusable Pico <dialog> confirm prompt — Promise-based replacement for
// window.confirm() (see components/ui/confirm-dialog.ejs, included once in
// page-foot.ejs so every page shares one instance). Confirm/Cancel resolve
// the promise directly; dismissing via backdrop click or Esc goes through
// modal.service's own listeners (not this module's button handlers), so the
// dialog's native `close` event — which fires either way — is what actually
// settles the promise, defaulting to `false` unless Confirm was clicked.
import { closeModal, openModal } from './modal.service.js';

let resolveCurrent = null;
let confirmed = false;

export function showConfirmDialog({
  title = 'ยืนยันการดำเนินการ',
  message = '',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  danger = true,
} = {}) {
  const modal = document.getElementById('confirmDialog');
  document.getElementById('confirmDialogTitle').textContent = title;
  document.getElementById('confirmDialogMessage').textContent = message;

  const confirmBtn = document.getElementById('confirmDialogConfirmBtn');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = `p-btn ${danger ? 'p-btn-pink' : 'p-btn-sky'}`;
  document.getElementById('confirmDialogCancelBtn').textContent = cancelText;

  return new Promise((resolve) => {
    resolveCurrent = resolve;
    confirmed = false;
    openModal(modal);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('confirmDialog');
  if (!modal) return;

  document.getElementById('confirmDialogConfirmBtn').addEventListener('click', () => {
    confirmed = true;
    closeModal(modal);
  });
  document.getElementById('confirmDialogCancelBtn').addEventListener('click', () => {
    confirmed = false;
    closeModal(modal);
  });
  modal.addEventListener('close', () => {
    resolveCurrent?.(confirmed);
    resolveCurrent = null;
  });
});
