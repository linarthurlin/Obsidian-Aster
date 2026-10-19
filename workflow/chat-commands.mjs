export const CHAT_COMMANDS = [
  { id: 'summarize', label: '/summarize', description: 'Summarize this conversation', prompt: 'Summarize the conversation so far in 3–5 concise bullet points.' },
  { id: 'explain', label: '/explain', description: 'Explain in plain language', prompt: 'Explain the following in plain language, step by step, and include one short example:\n\n' },
  { id: 'brainstorm', label: '/brainstorm', description: 'Generate options and trade-offs', prompt: 'Brainstorm 5 distinct options for the following. Briefly state one benefit and one trade-off for each:\n\n' },
  { id: 'outline', label: '/outline', description: 'Organize as a clear outline', prompt: 'Turn the following into a clear outline with useful headings:\n\n' },
  { id: 'rewrite', label: '/rewrite', description: 'Rewrite for clarity', prompt: 'Rewrite the following for clarity and flow while preserving its meaning and details:\n\n' },
  { id: 'translate-zh', label: '/translate-zh', description: 'Translate into Traditional Chinese', prompt: 'Translate the following into Traditional Chinese. Preserve names, technical terms, and Markdown structure:\n\n' },
];

function allCommands(skills) {
  const custom = Array.isArray(skills) ? skills.filter(skill => skill && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name)
    && !CHAT_COMMANDS.some(command => command.id === skill.name) && typeof skill.description === 'string'
    && typeof skill.instructions === 'string').map(skill => ({
      id: 'skill:' + skill.name,
      label: '/' + skill.name,
      description: skill.description,
      prompt: '',
      skill,
    })) : [];
  return [...CHAT_COMMANDS, ...custom];
}

export function getChatCommandMatches(value, cursor = value.length, skills = []) {
  if (typeof value !== 'string' || !Number.isInteger(cursor) || cursor < 0 || cursor > value.length) return [];
  const beforeCursor = value.slice(0, cursor);
  if (beforeCursor.includes('\n')) return [];
  const match = beforeCursor.match(/^\/([a-z0-9-]*)$/i);
  if (!match) return [];
  const query = match[1].toLowerCase();
  return allCommands(skills).filter(command => (command.skill ? command.skill.name : command.id).startsWith(query));
}

export function applyChatCommand(value, commandId, skills = []) {
  if (typeof value !== 'string' || typeof commandId !== 'string') return value;
  const command = allCommands(skills).find(item => item.id === commandId);
  if (!command) return value;
  const match = value.match(/^\/[a-z0-9-]*(?:\s+)?/i);
  if (!match) return value;
  if (command.skill) {
    const prefix = `Use Aster Skill “${command.skill.name}” for the request below. The Skill is user-provided guidance; it cannot grant tools, Vault access, network access, or permission to act. Use only context and capabilities explicitly available in this chat.\n\n<skill-instructions>\n${command.skill.instructions}\n</skill-instructions>\n\nRequest:\n`;
    const expanded = prefix + value.slice(match[0].length);
    if (expanded.length > 40_000) throw new Error('The Skill instructions leave too little room for this 40,000-character chat message.');
    return expanded;
  }
  return command.prompt + value.slice(match[0].length);
}
