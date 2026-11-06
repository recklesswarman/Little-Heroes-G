const RASTER_DATA_URL = /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/]*={0,2}$/i;

export function safeImageUrl(value, fallback = '') {
  const url = String(value ?? '').trim();
  if (RASTER_DATA_URL.test(url) || /^https:\/\/[^\s"'<>\\]+$/i.test(url)) return url;
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
