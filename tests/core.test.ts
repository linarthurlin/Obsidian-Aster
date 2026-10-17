import { describe, it, expect } from 'vitest';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/settings';
import { TEMPLATES, createInsertion } from '../src/commands';
import { NativeMaterialController } from '../src/native';

describe('persisted settings', () => {
  it('recovers from corrupt/untrusted stored values', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ palette: 'bad', contentWidth: NaN, roundedImages: 'false' })).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps layout width without allowing CSS injection', () => {
    expect(normalizeSettings({ contentWidth: 0 }).contentWidth).toBe(640);
    expect(normalizeSettings({ contentWidth: 9000 }).contentWidth).toBe(1100);
    expect(normalizeSettings({ contentWidth: '0;display:none' }).contentWidth).toBe(820);
  });
});
describe('Markdown insertions', () => {
  it('isolates a block inserted within a paragraph', () => {
    const insertion = createInsertion(TEMPLATES[1], '', 'before', 'after');
    expect(insertion.text).toBe('\n## Heading\n');
    expect(insertion.text.slice(insertion.selectionStart, insertion.selectionEnd)).toBe('Heading');
  });
  it('preserves multiline selection inside a callout', () => {
    const template = TEMPLATES.find(t => t.id === 'callout-note')!;
    expect(createInsertion(template, '第一行\n第二行', '', '').text).toBe('> [!note]\n> 第一行\n> 第二行');
  });
  it('preserves newlines and content in fenced code', () => {
    const template = TEMPLATES.find(t => t.id === 'code')!;
    expect(createInsertion(template, 'a\nb', '\n', '\n').text).toBe('```text\na\nb\n```');
  });
  it('keeps all command ids unique', () => expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length));
});
describe('optional native material lifecycle', () => {
  it('does not touch native windows on unsupported platforms', () => {
    const controller = new NativeMaterialController();
    const calls: string[] = [];
    expect(controller.apply({ setBackgroundMaterial: m => calls.push(m) }, 'acrylic', false).active).toBe(false);
    expect(calls).toEqual([]);
  });
  it('returns portable fallback when the API is missing or fails', () => {
    const controller = new NativeMaterialController();
    expect(controller.apply({}, 'mica', true).active).toBe(false);
    expect(controller.apply({ setBackgroundMaterial() { throw new Error('unsupported'); } }, 'mica', true).active).toBe(false);
  });
  it('releases only windows it owns when disabled or unloaded', () => {
    const controller = new NativeMaterialController();
    const calls: string[] = [];
    const win = { setBackgroundMaterial: (m: string) => calls.push(m) };
    controller.apply(win, 'acrylic', true);
    controller.apply(win, 'none', true);
    controller.dispose();
    expect(calls).toEqual(['acrylic', 'auto']);
  });
  it('cleans up all open windows and tolerates closed windows', () => {
    const controller = new NativeMaterialController();
    const calls: string[] = [];
    controller.apply({ setBackgroundMaterial: m => calls.push(m) }, 'mica', true);
    let destroyed = false;
    controller.apply({ setBackgroundMaterial: m => calls.push(m), isDestroyed: () => destroyed }, 'mica', true);
    destroyed = true;
    controller.dispose();
    expect(calls).toEqual(['mica', 'mica', 'auto']);
  });
});
