import { escapeHtml } from './utils.js';

export function showToast(message, type = 'info') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = `p-toast p-toast-${type}`;
  toast.innerHTML = escapeHtml(message);
  stack.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

/** Shows the first API error's message via toast — the common failure path for every service call. */
export function showApiError(error, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') {
  console.error(error);
  showToast(error?.message || fallback, 'error');
}
