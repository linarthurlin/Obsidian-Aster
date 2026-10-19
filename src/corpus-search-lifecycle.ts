import type { App, EventRef } from 'obsidian';
import { invalidateCorpusSearchIndex } from '../workflow/corpus.mjs';

export function registerCorpusSearchInvalidation(
  app: Pick<App, 'vault' | 'workspace'>,
  registerEvent: (eventRef: EventRef) => void,
  invalidate: () => void = invalidateCorpusSearchIndex,
) {
  let active = true;
  app.workspace.onLayoutReady(() => {
    if (!active) return;
    const onChange = () => { if (active) invalidate(); };
    registerEvent(app.vault.on('create', onChange));
    registerEvent(app.vault.on('modify', onChange));
    registerEvent(app.vault.on('delete', onChange));
    registerEvent(app.vault.on('rename', onChange));
  });
  return () => { active = false; };
}
