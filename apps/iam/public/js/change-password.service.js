// Mandatory password change flow — triggered when the session's
// must_change_password flag is set (fresh account on an admin-generated temp
// password). AuthGuard blocks every other endpoint server-side while this is
// true (see MUST_CHANGE_PASSWORD in all-exceptions-filter.util.ts), so this
// modal is the only way out; see components/change-password-modal.ejs.
import { CLIENT_APP_NAME, getCsrfToken, getCurrentUser, setUser, toApiError } from './login.service.js';
import { fetchWithAuth } from './auth-guard.service.js';
import { closeModal, openModal } from './modal.service.js';

function authBase() {
  return window.__AUTH_CONFIG__.baseUrl;
}

export function isMustChangePasswordError(error) {
  return (error?.errors ?? []).some((e) => e.code === 'MUST_CHANGE_PASSWORD');
}

export function showChangePasswordModal() {
  const form = document.getElementById('changePasswordForm');
  form?.reset();
  document.getElementById('changePasswordError')?.classList.add('hidden');
  openModal(document.getElementById('changePasswordModal'));
}

export async function handleChangePasswordSubmit(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('changePwCurrent').value;
  const newPassword = document.getElementById('changePwNew').value;
  const confirmPassword = document.getElementById('changePwConfirm').value;
  const errorEl = document.getElementById('changePasswordError');
  errorEl.classList.add('hidden');

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน';
    errorEl.classList.remove('hidden');
    return;
  }
  if (newPassword.length < 8) {
    errorEl.textContent = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร';
    errorEl.classList.remove('hidden');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const response = await fetchWithAuth(`${authBase()}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-App': CLIENT_APP_NAME,
        ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken() } : {}),
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    if (!response.ok) throw await toApiError(response);

    const user = getCurrentUser();
    if (user) setUser({ ...user, must_change_password: false });
    closeModal(document.getElementById('changePasswordModal'));
    // Simplest correct recovery: reload so every view re-fetches now that
    // the session is fully usable again.
    window.location.reload();
  } catch (error) {
    errorEl.textContent = error.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}
