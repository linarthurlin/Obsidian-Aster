import { it, expect } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings';
import { selectionVariables } from '../src/selection';
it('migrates old settings to paired glass defaults and rejects CSS injection', () => {
  const old = normalizeSettings({ palette: 'rose', selectionLightStart: 'red);display:none', selectionDarkEnd: '#ABCDEF', selectionBlur: Infinity, selectionGlass: -1, selectionAngle: 900 });
  expect(old.palette).toBe('rose');
  expect(old.selectionLightStart).toBe('#e9d9ba');
  expect(old.selectionDarkEnd).toBe('#abcdef');
  expect(old.selectionBlur).toBe(12);
  expect(old.selectionGlass).toBe(0);
  expect(old.selectionAngle).toBe(360);
  expect(normalizeSettings({ selectionLightOpacity: 0, selectionDarkOpacity: 999 }).selectionLightOpacity).toBe(10);
  expect(normalizeSettings({ selectionDarkOpacity: 999 }).selectionDarkOpacity).toBe(100);
});
it('allows a flat zero-glass mode and independent backdrop blur without changing text opacity', () => {
  const flat = selectionVariables({ ...DEFAULT_SETTINGS, selectionGlass: 0 });
  expect(flat['--pg-selection-blur']).toBe('0px');
  expect(flat['--pg-selection-highlight']).toBe('0%');
  expect(flat['--pg-selection-shadow']).toBe('0%');
  const glass = selectionVariables({ ...DEFAULT_SETTINGS, selectionGlass: 100, selectionBlur: 24, selectionDarkOpacity: 45 });
  expect(glass['--pg-selection-blur']).toBe('24px');
  expect(glass['--pg-selection-dark-opacity']).toBe('45%');
  expect(glass).not.toHaveProperty('opacity');
});
it('adapts text for very dark or very light custom selection fills', () => {
  const dark = selectionVariables({ ...DEFAULT_SETTINGS, selectionLightStart: '#000000', selectionLightEnd: '#000000', selectionLightOpacity: 100 });
  expect(dark['--pg-selection-light-text']).toBe('#ffffff');
  const light = selectionVariables({ ...DEFAULT_SETTINGS, selectionDarkStart: '#ffffff', selectionDarkEnd: '#ffffff', selectionDarkOpacity: 100 });
  expect(light['--pg-selection-dark-text']).toBe('#151915');
});
