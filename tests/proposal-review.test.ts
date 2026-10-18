import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderProposalReviewCard, type ProposalReviewCard } from '../src/proposal-review';

it('requires approval and applies or rolls back only the individually selected change', async () => {
  const dom = new JSDOM('<main></main>');
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    const parent = dom.window.document.querySelector('main') as HTMLElement;
    const applied: string[] = [];
    const rolledBack: string[] = [];
    const cards: ProposalReviewCard[] = [];
    const changes = ['One.md', 'Two.md'].map(path => renderProposalReviewCard(parent, {
      path, reason: 'Supported change.', diff: `--- ${path}\n+++ ${path}\n`,
      sources: [{ path: 'Evidence.md', locator: 'line 1', excerpt: 'Exact synthetic evidence.' }],
    }, {
      setBusy: busy => cards.forEach(card => card.setExternalBusy(busy)),
      apply: async () => { applied.push(path); return `${path}.private.json`; },
      rollback: async receipt => { rolledBack.push(receipt); },
    }));
    cards.push(...changes);

    const first = parent.querySelectorAll('.pga-proposal-change')[0] as HTMLElement;
    const second = parent.querySelectorAll('.pga-proposal-change')[1] as HTMLElement;
    const firstCheckbox = first.querySelector('input[type=checkbox]') as HTMLInputElement;
    const secondApply = second.querySelector('button') as HTMLButtonElement;
    const firstButtons = first.querySelectorAll('button');
    const firstApply = firstButtons[0] as HTMLButtonElement;
    const firstRollback = firstButtons[1] as HTMLButtonElement;
    expect(firstApply.disabled).toBe(true);
    expect(secondApply.disabled).toBe(true);

    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new dom.window.Event('change'));
    expect(firstApply.disabled).toBe(false);
    expect(secondApply.disabled).toBe(true);
    firstApply.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(applied).toEqual(['One.md']);
    expect(firstRollback.disabled).toBe(false);
    expect(secondApply.disabled).toBe(true);
    expect(second.textContent).toContain('Two.md');

    firstRollback.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(rolledBack).toEqual(['One.md.private.json']);
    expect(firstApply.disabled).toBe(true);
    expect(first.textContent).toContain('Rolled back');
  } finally {
    Object.defineProperty(globalThis, 'document', { value: previousDocument, configurable: true });
    dom.window.close();
  }
});
