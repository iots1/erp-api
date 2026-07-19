// Canonical Pico <dialog> open/close (https://picocss.com/docs/modal) — ported
// from Pico's own examples/js/modal.js so our modals get the same
// modal-is-open/-opening/-closing animation classes (defined in Pico's core
// CSS), scrollbar-width compensation, click-outside-to-close, and Escape-to-
// close. Pages keep their own openXxxModal()/closeXxxModal() wrappers for
// async data loading / form reset — those call openModal(el)/closeModal(el)
// once the dialog element is ready, instead of raw showModal()/close().
const OPEN_CLASS = 'modal-is-open';
const OPENING_CLASS = 'modal-is-opening';
const CLOSING_CLASS = 'modal-is-closing';
const SCROLLBAR_WIDTH_VAR = '--pico-scrollbar-width';
const ANIMATION_DURATION = 400; // ms — matches Pico's CSS animation timing

let visibleModal = null;

function getScrollbarWidth() {
  return window.innerWidth - document.documentElement.clientWidth;
}

// An open <dialog> is promoted to the browser's top layer, which renders
// above every other element in the document regardless of z-index — so the
// fixed-position #toastStack would sit behind the dialog's own backdrop and
// become unreadable. Move it inside the dialog while one is open so an API
// error surfaced mid-form still reads clearly, then move it back to <body>.
function relocateToastStack(target) {
  const stack = document.getElementById('toastStack');
  if (stack && stack.parentElement !== target) target.appendChild(stack);
}

export function openModal(modal) {
  if (!modal || modal.open) return;
  const html = document.documentElement;
  const scrollbarWidth = getScrollbarWidth();
  if (scrollbarWidth) html.style.setProperty(SCROLLBAR_WIDTH_VAR, `${scrollbarWidth}px`);
  html.classList.add(OPEN_CLASS, OPENING_CLASS);
  relocateToastStack(modal);
  setTimeout(() => {
    visibleModal = modal;
    html.classList.remove(OPENING_CLASS);
  }, ANIMATION_DURATION);
  modal.showModal();
}

export function closeModal(modal) {
  if (!modal || !modal.open) return;
  visibleModal = null;
  const html = document.documentElement;
  html.classList.add(CLOSING_CLASS);
  setTimeout(() => {
    html.classList.remove(CLOSING_CLASS, OPEN_CLASS);
    html.style.removeProperty(SCROLLBAR_WIDTH_VAR);
    modal.close();
    relocateToastStack(document.body);
  }, ANIMATION_DURATION);
}

// Close with a click outside the <article> — skipped for modals marked
// `data-persistent` (the forced session-expired re-login has no close button
// on purpose; it shouldn't be dismissible by clicking past it either).
document.addEventListener('click', (event) => {
  if (!visibleModal || visibleModal.hasAttribute('data-persistent')) return;
  const content = visibleModal.querySelector('article');
  if (content && !content.contains(event.target)) closeModal(visibleModal);
});

// Close with the Esc key (mirrors the dialog's own native behavior so the
// animation classes stay in sync when it's our tracked visibleModal).
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !visibleModal) return;
  if (visibleModal.hasAttribute('data-persistent')) return;
  closeModal(visibleModal);
});

// <dialog> also closes itself natively on Esc (fires a cancelable `cancel`
// event first) independently of the keydown listener above — block that too
// for `data-persistent` modals. `cancel` doesn't bubble, so this must be a
// capture-phase listener to see it.
document.addEventListener(
  'cancel',
  (event) => {
    if (event.target?.hasAttribute?.('data-persistent')) event.preventDefault();
  },
  true,
);
