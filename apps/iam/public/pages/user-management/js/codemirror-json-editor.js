// Thin wrapper around CodeMirror 6 for editing a JSON document (print-templates
// form's Mock Data field). Mirrors codemirror-html-editor.js's shape so both
// editors are interchangeable from the caller's point of view, plus a
// `format()` helper for a one-click JSON.stringify(..., null, 2) tidy-up.
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, basicSetup } from 'codemirror';

/**
 * Mounts a CodeMirror JSON editor into `mountEl`. `onChange(doc)` fires on
 * every document change (already debounced by the caller if needed).
 * @returns {{ getValue: () => string, setValue: (doc: string) => void, format: () => boolean }}
 */
export function createJsonEditor({ mountEl, initialDoc = '', onChange }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const view = new EditorView({
    doc: initialDoc,
    extensions: [
      basicSetup,
      json(),
      ...(isDark ? [oneDark] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange?.(update.state.doc.toString());
      }),
      EditorView.theme({ '&': { height: '100%' } }),
    ],
    parent: mountEl,
  });

  const setValue = (doc) => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
  };

  return {
    getValue: () => view.state.doc.toString(),
    setValue,
    /** Re-indents the current document as pretty JSON in place. Returns
     * false (leaving the editor untouched) if the content isn't valid JSON,
     * so the caller can show its own error instead of this silently no-oping. */
    format: () => {
      const raw = view.state.doc.toString().trim();
      if (!raw) return true;
      try {
        setValue(JSON.stringify(JSON.parse(raw), null, 2));
        return true;
      } catch {
        return false;
      }
    },
  };
}
