// Thin wrapper around CodeMirror 6 for a single-purpose "edit a full HTML
// document" box (print-templates form). Kept separate from
// print-templates.service.js so the CodeMirror setup/theme details don't
// clutter that file's actual business logic.
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, basicSetup } from 'codemirror';

/**
 * Mounts a CodeMirror editor into `mountEl`. `onChange(doc)` fires on every
 * document change (already debounced by the caller if needed — this wrapper
 * itself does not debounce).
 * @returns {{ getValue: () => string, setValue: (doc: string) => void }}
 */
export function createHtmlEditor({ mountEl, initialDoc = '', onChange }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const view = new EditorView({
    doc: initialDoc,
    extensions: [
      basicSetup,
      html(),
      ...(isDark ? [oneDark] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange?.(update.state.doc.toString());
      }),
      EditorView.theme({ '&': { height: '100%' } }),
    ],
    parent: mountEl,
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (doc) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
    },
  };
}
