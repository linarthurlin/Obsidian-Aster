import { readFile, writeFile } from 'node:fs/promises';
import { search, propose, review, apply, inspectTransactionJournal, recoverTransactionJournal, rollbackTransactionJournal } from './knowledge.mjs';
import { prepareContext, contextDigest, assertContextFresh, suggestionPlan } from './corpus.mjs';
import { runCodex } from './codex.mjs';
const [command, ...args] = process.argv.slice(2);
function arg(name, required = true) {
  const i = args.indexOf(`--${name}`), value = i >= 0 ? args[i + 1] : undefined;
  if (required && (!value || value.startsWith('--'))) throw new Error(`Missing --${name}`);
  return value;
}
const json = async name => JSON.parse(await readFile(arg(name), 'utf8'));
try {
  if (command === 'context') {
    const context = await prepareContext(arg('corpus'), arg('query'), arg('target'));
    await writeFile(arg('out'), JSON.stringify(context, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ digest: contextDigest(context), context }, null, 2));
  } else if (command === 'codex-plan') {
    const context = await json('context');
    await assertContextFresh(arg('corpus'), context);
    const output = await runCodex(context, { approvedDigest: arg('approve-context'), executable: arg('executable', false), model: arg('model', false) });
    const reviewed = await suggestionPlan(arg('corpus'), context, output);
    if (reviewed) { await writeFile(arg('out'), JSON.stringify(reviewed.plan, null, 2), { flag: 'wx' }); console.log(JSON.stringify(reviewed.review, null, 2)); }
    else console.log(JSON.stringify({ status: 'no_change', reason: output.reason }));
  } else if (command === 'search') console.log(JSON.stringify(await search(arg('vault'), arg('query')), null, 2));
  else if (command === 'plan') {
    const plan = await propose(arg('vault'), await json('operations'));
    await writeFile(arg('out'), JSON.stringify(plan, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(review(plan), null, 2));
  } else if (command === 'review') console.log(JSON.stringify(review(await json('plan')), null, 2));
  else if (command === 'apply') console.log(JSON.stringify(await apply(arg('vault'), await json('plan'), arg('review'), arg('transaction')), null, 2));
  else if (command === 'inspect') console.log(JSON.stringify(await inspectTransactionJournal(arg('vault'), arg('transaction')), null, 2));
  else if (command === 'recover') console.log(JSON.stringify(await recoverTransactionJournal(arg('vault'), arg('transaction')), null, 2));
  else if (command === 'rollback') console.log(JSON.stringify(await rollbackTransactionJournal(arg('vault'), arg('transaction')), null, 2));
  else console.log('Aster offline workflow: context | codex-plan | search | plan | review | apply | inspect | recover | rollback. See workflow/README.md.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
