const RASTER_DATA_URL = /^data:image\/(?:jpeg|png|gif|webp|avif|bmp);base64,[a-z0-9+/]*={0,2}$/i;
// Generated icons are percent-encoded SVG. Scripts inside an SVG never run when
// it is loaded through <img>, and raw markup characters are still refused.
const ENCODED_SVG_DATA_URL = /^data:image\/svg\+xml(?:;charset=utf-8|;utf8)?,[^\s"<>\\]*$/i;
// The storage service falls back to same-origin object URLs when uploads fail.
const BLOB_URL = /^blob:https?:\/\/[^\s"'<>\\]+$/i;

export function safeImageUrl(value, fallback = '') {
  const url = String(value ?? '').trim();
  if (
    RASTER_DATA_URL.test(url) ||
    ENCODED_SVG_DATA_URL.test(url) ||
    BLOB_URL.test(url) ||
    /^https:\/\/[^\s"'<>\\]+$/i.test(url)
  ) {
    return url;
  }
  if (
    url &&
    !url.startsWith('//') &&
    !url.includes('\\') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(url) &&
    !/[\u0000-\u001f"'<>]/.test(url)
  ) {
    return url;
  }
  return fallback;
}
