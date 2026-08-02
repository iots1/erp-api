// Thin wrapper around CodeMirror 6 for editing a print template's own
// paginator script override (print-templates form's "JavaScript" field).
// Mirrors codemirror-html-editor.js's shape so both editors are
// interchangeable from the caller's point of view.
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, basicSetup } from 'codemirror';

/**
 * Mounts a CodeMirror JavaScript editor into `mountEl`. `onChange(doc)`
 * fires on every document change (already debounced by the caller if needed).
 * @returns {{ getValue: () => string, setValue: (doc: string) => void }}
 */
export function createJavascriptEditor({ mountEl, initialDoc = '', onChange }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const view = new EditorView({
    doc: initialDoc,
    extensions: [
      basicSetup,
      javascript(),
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
