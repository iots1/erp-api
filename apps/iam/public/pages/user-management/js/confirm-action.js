// The confirm → call API → toast → refresh sequence every destructive row
// action in this admin performs (delete role/policy/user/access-key/
// permission/print-template/document-type, revoke an access key, reset a
// password). Each of those was its own near-identical copy of this block;
// only the strings, the API call, and what happens after success differ.
import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { showApiError, showToast } from './toast.service.js';

/**
 * @param {object} options
 * @param {string} options.title            Dialog heading.
 * @param {string} options.message          Dialog body.
 * @param {string} [options.confirmText]    Confirm button label (default 'ลบ').
 * @param {boolean} [options.danger]        Style the confirm button as destructive.
 * @param {() => Promise<any>} options.action        The API call to run once confirmed.
 * @param {string} [options.successMessage] Toast shown on success; omit for
 *   actions whose own success UI replaces it (e.g. reset-password, which opens
 *   the temp-password modal instead).
 * @param {string} options.errorMessage     Fallback message for showApiError.
 * @param {(result: any) => any} [options.onSuccess] Runs after the toast —
 *   typically the list reload, or opening a follow-up modal.
 * @returns {Promise<boolean>} Whether the action ran and succeeded. Callers
 *   that need to branch (cancelled vs. failed vs. done) can use it; most don't.
 */
export async function confirmAndRun({
  title,
  message,
  confirmText = 'ลบ',
  danger,
  action,
  successMessage,
  errorMessage,
  onSuccess,
}) {
  const confirmed = await showConfirmDialog({ title, message, confirmText, danger });
  if (!confirmed) return false;

  try {
    const result = await action();
    if (successMessage) showToast(successMessage, 'success');
    await onSuccess?.(result);
    return true;
  } catch (error) {
    showApiError(error, errorMessage);
    return false;
  }
}
