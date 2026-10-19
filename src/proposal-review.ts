export interface ProposalReviewSource {
  path: string;
  excerpt: string;
  locator?: string;
}

export interface ProposalReviewChange {
  path: string;
  reason: string;
  diff: string;
  sources: ProposalReviewSource[];
}

export interface ProposalReviewCard {
  element: HTMLElement;
  setExternalBusy(busy: boolean): void;
}

export function renderProposalReviewCard(
  parent: HTMLElement,
  change: ProposalReviewChange,
  actions: { apply(): Promise<string>; rollback(receipt: string): Promise<void>; setBusy(busy: boolean): void },
): ProposalReviewCard {
  const card = document.createElement('section');
  card.className = 'pga-proposal-change';
  const heading = document.createElement('h4');
  heading.textContent = change.path;
  card.appendChild(heading);
  const reason = document.createElement('p');
  reason.textContent = change.reason;
  card.appendChild(reason);
  const diff = document.createElement('pre');
  diff.className = 'pga-code';
  diff.textContent = change.diff;
  card.appendChild(diff);
  for (const source of change.sources) {
    const sourceHeading = document.createElement('h5');
    sourceHeading.textContent = source.path + (source.locator ? ' · ' + source.locator : '');
    card.appendChild(sourceHeading);
    const excerpt = document.createElement('blockquote');
    excerpt.textContent = source.excerpt;
    card.appendChild(excerpt);
  }
  const approval = document.createElement('label');
  approval.className = 'pga-consent';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  approval.append(checkbox, document.createTextNode(' I reviewed this change and its evidence / 已審核此項差異與證據'));
  card.appendChild(approval);
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.textContent = 'Apply this change / 套用此項';
  applyButton.disabled = true;
  card.appendChild(applyButton);
  const rollbackButton = document.createElement('button');
  rollbackButton.type = 'button';
  rollbackButton.textContent = 'Rollback this change / 回復此項';
  rollbackButton.disabled = true;
  card.appendChild(rollbackButton);
  const status = document.createElement('p');
  status.className = 'pga-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  card.appendChild(status);
  parent.appendChild(card);

  let receipt = '';
  let busy = false;
  let externalBusy = false;
  const refresh = () => {
    checkbox.disabled = busy || externalBusy || !!receipt;
    applyButton.disabled = busy || externalBusy || !checkbox.checked || !!receipt;
    rollbackButton.disabled = busy || externalBusy || !receipt;
  };
  checkbox.addEventListener('change', refresh);
  applyButton.addEventListener('click', async () => {
    if (busy || externalBusy || !checkbox.checked || receipt) return;
    busy = true;
    actions.setBusy(true);
    refresh();
    status.textContent = 'Applying this reviewed change…';
    try {
      receipt = await actions.apply();
      status.textContent = 'Applied. Private recovery journal: ' + receipt;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not apply this change.';
    } finally {
      busy = false;
      actions.setBusy(false);
      refresh();
    }
  });
  rollbackButton.addEventListener('click', async () => {
    if (busy || externalBusy || !receipt) return;
    busy = true;
    actions.setBusy(true);
    refresh();
    status.textContent = 'Restoring the reviewed before-state…';
    try {
      await actions.rollback(receipt);
      receipt = '';
      checkbox.checked = false;
      status.textContent = 'Rolled back. Later edits are protected by target hash checks.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not roll back this change.';
    } finally {
      busy = false;
      actions.setBusy(false);
      refresh();
    }
  });
  return {
    element: card,
    setExternalBusy(value: boolean) { externalBusy = value; refresh(); },
  };
}
