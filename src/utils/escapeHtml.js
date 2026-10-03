// escapeHtml.js -- this app renders views as raw template-literal HTML
// strings assigned via innerHTML (see main.js's renderApp()), with no
// framework-level auto-escaping. Any user-controlled text (a hero's name,
// a reward title, anything a parent or kid can type or that arrives from a
// cloud-synced household document) must be escaped before interpolation,
// or it can break out of a text node or a quoted attribute and execute as
// HTML/script in every device that later renders that same household data.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
