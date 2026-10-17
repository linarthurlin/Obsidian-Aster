import { readFile, writeFile } from 'node:fs/promises';
import { search, propose, review, apply, rollback } from './knowledge.mjs';
const [command, ...args] = process.argv.slice(2);
function arg(name, required = true) {
  const i = args.indexOf(`--${name}`), value = i >= 0 ? args[i + 1] : undefined;
  if (required && (!value || value.startsWith('--'))) throw new Error(`Missing --${name}`);
  return value;
}
const json = async name => JSON.parse(await readFile(arg(name), 'utf8'));
try {
  if (command === 'search') console.log(JSON.stringify(await search(arg('vault'), arg('query')), null, 2));
  else if (command === 'plan') {
    const plan = await propose(arg('vault'), await json('operations'));
    await writeFile(arg('out'), JSON.stringify(plan, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(review(plan), null, 2));
  } else if (command === 'review') console.log(JSON.stringify(review(await json('plan')), null, 2));
  else if (command === 'apply') console.log(JSON.stringify(await apply(arg('vault'), await json('plan'), arg('review'), arg('transaction')), null, 2));
  else if (command === 'rollback') console.log(JSON.stringify(await rollback(arg('vault'), await json('transaction')), null, 2));
  else console.log('Personal Glass offline workflow: search | plan | review | apply | rollback. See workflow/README.md.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
