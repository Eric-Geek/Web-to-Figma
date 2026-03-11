/// <reference types="@figma/plugin-typings/plugin-api" />

import { renderDocument } from './renderer';
import type { IntermediateDocument } from '@web-to-figma/shared';
import { validateDocument } from '@web-to-figma/shared';

figma.showUI(__html__, { width: 400, height: 300, themeColors: true });

figma.ui.onmessage = async (msg: { type: string; payload?: unknown }) => {
  switch (msg.type) {
    case 'IMPORT_JSON': {
      try {
        const validation = validateDocument(msg.payload);
        if (!validation.valid) {
          figma.ui.postMessage({
            type: 'RENDER_ERROR',
            payload: `Invalid JSON:\n${validation.errors.join('\n')}`,
          });
          return;
        }

        const data = msg.payload as IntermediateDocument;
        await renderDocument(data, (progress: number) => {
          figma.ui.postMessage({ type: 'RENDER_PROGRESS', payload: progress });
        });
        figma.ui.postMessage({ type: 'RENDER_COMPLETE' });
        figma.notify('Import complete!');
      } catch (err) {
        figma.ui.postMessage({
          type: 'RENDER_ERROR',
          payload: (err as Error).message,
        });
      }
      break;
    }

    case 'CANCEL':
      figma.closePlugin();
      break;
  }
};
