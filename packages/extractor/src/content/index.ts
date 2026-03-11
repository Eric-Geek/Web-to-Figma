/**
 * Content Script entry point.
 * Injected into web pages to extract DOM structure and computed styles.
 */

import { extractDOM } from './extractor';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_DOM') {
    const options = message.payload ?? {};
    extractDOM(options)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err: Error) =>
        sendResponse({ success: false, error: err.message }),
      );
    return true; // keep message channel open for async response
  }
});
