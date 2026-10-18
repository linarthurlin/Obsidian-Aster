import type { AsterSkill } from './skills.mjs';
export interface ChatCommand { id: string; label: string; description: string; prompt: string; skill?: AsterSkill }
export const CHAT_COMMANDS: ChatCommand[];
export function getChatCommandMatches(value: string, cursor?: number, skills?: AsterSkill[]): ChatCommand[];
export function applyChatCommand(value: string, commandId: string, skills?: AsterSkill[]): string;
