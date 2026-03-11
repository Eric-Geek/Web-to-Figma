/**
 * Background Service Worker.
 * Handles CORS proxy requests and AI API calls.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'PROXY_FETCH') {
    const { url, options, referer } = message.payload;
    const fetchOptions = {
      ...options,
      headers: {
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...(referer ? { 'Referer': referer, 'Origin': new URL(referer).origin } : {}),
        ...(options?.headers || {}),
      },
    };
    fetch(url, fetchOptions)
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || 'image/png';
        const mime = contentType.split(';')[0].trim();
        const buffer = await res.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            '',
          ),
        );
        sendResponse({ success: true, data: base64, mime });
      })
      .catch((err: Error) =>
        sendResponse({ success: false, error: err.message }),
      );
    return true;
  }
});
