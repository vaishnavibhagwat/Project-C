import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { endpointUrl } from '@/data/api';
import { defaultSnapshot } from '@/registry/pages';
import {
  addWidget,
  applySnapshot,
  canAddWidget,
  duplicateWidget,
  MAX_WIDGETS_PER_PAGE,
  widgetCount,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { themeToCssVars } from '@/theme/applyTheme';
import { BUILT_IN_THEMES, themeIdForSetting } from '@/theme/themes';
import { parseEnv } from '@/utils/env';

// Vitest runs from the project root.
const root = (path: string) => join(process.cwd(), path);
const read = (path: string) => readFileSync(root(path), 'utf8');

describe('environment variables', () => {
  it('reads the documented .env.example values', () => {
    const values = Object.fromEntries(
      read('.env.example')
        .split(/\r?\n/)
        .filter((line) => /^VITE_\w+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
    const env = parseEnv(values);
    expect(env).toMatchObject({
      VITE_API_BASE_URL: '/api',
      VITE_WS_URL: 'ws://localhost:5173/ws',
      VITE_DEFAULT_THEME: 'light',
      VITE_DATA_REFRESH_INTERVAL: 30000,
      VITE_MAX_WIDGETS: 20,
      VITE_ENABLE_MOCK_AUTH: true,
    });
  });

  it('rejects invalid values with the variable name', () => {
    expect(() => parseEnv({ VITE_WS_URL: 'http://example.com' })).toThrow(/VITE_WS_URL/);
    expect(() => parseEnv({ VITE_DEFAULT_THEME: 'purple' })).toThrow(/VITE_DEFAULT_THEME/);
    expect(() => parseEnv({ VITE_MAX_WIDGETS: '0' })).toThrow(/VITE_MAX_WIDGETS/);
    expect(() => parseEnv({ VITE_DATA_REFRESH_INTERVAL: '10' })).toThrow(
      /VITE_DATA_REFRESH_INTERVAL/,
    );
    expect(() => parseEnv({ VITE_ENABLE_MOCK_AUTH: 'yes' })).toThrow(/VITE_ENABLE_MOCK_AUTH/);
  });

  it('maps the default theme setting to a built-in theme', () => {
    expect(themeIdForSetting('light')).toBe('porcelain');
    expect(themeIdForSetting('dark')).toBe('midnight-graphite');
    expect(themeIdForSetting('high-contrast')).toBe('high-contrast');
  });

  it('labels mock requests under the API base URL', () => {
    expect(endpointUrl('risk/var', '/api')).toBe('/api/risk/var');
    expect(endpointUrl('risk/var', 'https://example.com/v1/')).toBe(
      'https://example.com/v1/risk/var',
    );
  });
});

describe('first-paint theme CSS', () => {
  const css = read('src/theme/global.css');
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    const body = css.slice(start, css.indexOf('}', start));
    const vars: Record<string, string> = {};
    for (const m of body.matchAll(/(--color-[a-z0-9-]+):\s*([\d ]+);/g)) {
      if (m[1] && m[2]) vars[m[1]] = m[2].trim();
    }
    return vars;
  };

  it.each([
    [':root', 'midnight-graphite'],
    [":root[data-boot-theme='porcelain']", 'porcelain'],
    [":root[data-boot-theme='high-contrast']", 'high-contrast'],
  ])('%s declares the same tokens as the %s theme', (selector, id) => {
    const theme = BUILT_IN_THEMES.find((t) => t.id === id);
    if (!theme) throw new Error(`missing theme ${id}`);
    expect(block(selector)).toEqual(themeToCssVars(theme));
  });
});

describe('Content Security Policy', () => {
  const html = read('index.html');

  it('restricts scripts to this origin', () => {
    expect(html).toContain(
      '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'" />',
    );
  });

  it('has no inline scripts (they would be blocked)', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc="\//);
      expect(body?.trim()).toBe('');
    }
  });

  it('first-paint script applies the configured default theme for new visitors', async () => {
    const meta = document.createElement('meta');
    meta.name = 'meridian-default-theme';
    meta.content = 'light';
    document.head.append(meta);
    localStorage.clear();
    // Importing the classic script runs it once (it is a self-invoking function).
    const script = '../../public/theme-init.js';
    await import(/* @vite-ignore */ script);
    expect(document.documentElement.dataset.bootTheme).toBe('porcelain');
    meta.remove();
    delete document.documentElement.dataset.bootTheme;
  });
});

describe('per-page widget limit', () => {
  const initialDashboard = useDashboardStore.getState();
  const initialWidgets = useWidgetStore.getState();

  beforeEach(() => {
    useDashboardStore.setState(initialDashboard, true);
    useWidgetStore.setState(initialWidgets, true);
  });

  it('defaults to 20 widgets per page', () => {
    expect(MAX_WIDGETS_PER_PAGE).toBe(20);
  });

  it('refuses to add or duplicate beyond the limit', () => {
    while (canAddWidget('research')) {
      expect(addWidget('research', 'alerts-monitor')).not.toBeNull();
    }
    expect(widgetCount('research')).toBe(MAX_WIDGETS_PER_PAGE);
    expect(addWidget('research', 'alerts-monitor')).toBeNull();
    const first = useDashboardStore.getState().pages.research.itemIds[0] ?? '';
    expect(duplicateWidget('research', first)).toBeNull();
    expect(widgetCount('research')).toBe(MAX_WIDGETS_PER_PAGE);
  });

  it('keeps at most the limit when applying a large snapshot, and reports the rest', () => {
    const base = defaultSnapshot('research');
    const template = base.instances[0];
    if (!template) throw new Error('no instances');
    const instances = Array.from({ length: MAX_WIDGETS_PER_PAGE + 5 }, (_, i) => ({
      ...template,
      id: `bulk-${i}`,
    }));
    const lg = instances.map((inst, i) => ({ i: inst.id, x: 0, y: i * 4, w: 4, h: 4 }));
    const result = applySnapshot('research', { page: 'research', layouts: { lg }, instances });
    expect(result).toEqual({ applied: MAX_WIDGETS_PER_PAGE, dropped: 5 });
    expect(widgetCount('research')).toBe(MAX_WIDGETS_PER_PAGE);
  });
});
