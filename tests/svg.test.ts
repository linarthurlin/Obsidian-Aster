import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderFlow } from '../skills/personal-glass-svg/scripts/render-flow.mjs';
it('produces accessible offline SVGs with escaped Chinese/English text in both palettes', () => {
  for (const mode of ['light', 'dark']) {
    const svg = renderFlow({ title: '研究 <test>', description: 'An explicit flow', nodes: [
      { title: '捕獲 & 保留', detail: '原始資料來源' }, { title: 'Review', detail: 'Keep the evidence' } ] }, mode);
    const doc = new JSDOM(svg, { contentType: 'image/svg+xml' }).window.document;
    expect(doc.querySelector('title')?.textContent).toBe('研究 <test>');
    expect(doc.querySelectorAll('script, foreignObject, image')).toHaveLength(0);
    expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy();
    expect(Number(doc.documentElement.getAttribute('width'))).toBeGreaterThan(500);
    expect(doc.querySelectorAll('text').length).toBeGreaterThan(4);
  }
});
it('rejects oversized labels instead of silently clipping them', () => {
  expect(() => renderFlow({ title: 'x', description: 'x', nodes: [{ title: '很'.repeat(99), detail: '' }, { title: 'x', detail: '' }] }, 'light')).toThrow('larger/custom layout');
});
