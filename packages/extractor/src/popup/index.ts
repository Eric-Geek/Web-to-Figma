const extractBtn = document.getElementById('extract-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;

extractBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Scrolling page to load all content…';
  extractBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error('No active tab found');

    const tabId = tab.id;

    // Try sending message first — if content script is already injected, it will respond
    let response: { success: boolean; data?: unknown; error?: string } | undefined;
    try {
      response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_DOM' });
    } catch {
      // Content script not yet injected — inject it now
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/index.js'],
        });
      } catch {
        throw new Error('Cannot extract from this page (e.g. chrome:// pages)');
      }
      await new Promise((r) => setTimeout(r, 150));
      response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_DOM' });
    }

    if (!response?.success) {
      throw new Error(response?.error ?? 'Extraction failed');
    }

    const json = JSON.stringify(response.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `web-to-figma-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    statusEl.textContent = 'Done! JSON file downloaded.';
  } catch (err) {
    statusEl.textContent = `Error: ${(err as Error).message}`;
  } finally {
    extractBtn.disabled = false;
  }
});
