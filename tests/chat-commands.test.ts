import { expect, it } from 'vitest';
import { applyChatCommand, getChatCommandMatches } from '../workflow/chat-commands.mjs';

it('matches slash commands at the start of the composer and respects the caret', () => {
  expect(getChatCommandMatches('/sum').map(command => command.id)).toEqual(['summarize']);
  expect(getChatCommandMatches('/')).toHaveLength(6);
  expect(getChatCommandMatches('Please /sum')).toEqual([]);
  expect(getChatCommandMatches('/sum more', 4).map(command => command.id)).toEqual(['summarize']);
  expect(getChatCommandMatches('/sum', 0)).toEqual([]);
});

it('expands a chosen recipe into visible, ordinary user text before sending', () => {
  expect(applyChatCommand('/rewrite', 'unknown')).toBe('/rewrite');
  expect(applyChatCommand('/rewrite this paragraph', 'rewrite')).toBe('Rewrite the following for clarity and flow while preserving its meaning and details:\n\nthis paragraph');
  expect(applyChatCommand('/translate-zh  keep **Markdown**', 'translate-zh')).toBe('Translate the following into Traditional Chinese. Preserve names, technical terms, and Markdown structure:\n\nkeep **Markdown**');
  expect(applyChatCommand('/unknown text', 'unknown')).toBe('/unknown text');
});

it('offers custom Skills by slash name and expands their untrusted guidance into the editable draft', () => {
  const skill = { name: 'meeting-review', description: 'Extract decisions and owners from meeting notes.', instructions: 'List decisions, owners, and unresolved questions.' };
  expect(getChatCommandMatches('/meeting', 8, [skill]).map(command => command.id)).toEqual(['skill:meeting-review']);
  const expanded = applyChatCommand('/meeting-review Summarize the call.', 'skill:meeting-review', [skill]);
  expect(expanded).toContain('Skill “meeting-review”');
  expect(expanded).toContain('cannot grant tools, Vault access, network access, or permission to act');
  expect(expanded).toContain(skill.instructions);
  expect(expanded).toContain('Request:\nSummarize the call.');
  expect(applyChatCommand('/meeting-review', 'skill:meeting-review', [skill])).toContain('Request:\n');
});

it('rejects a Skill expansion that would exceed the chat message bound', () => {
  const skill = { name: 'long-skill', description: 'Long skill.', instructions: 'x'.repeat(24_000) };
  expect(() => applyChatCommand('/long-skill ' + 'y'.repeat(20_000), 'skill:long-skill', [skill])).toThrow('40,000-character');
});
