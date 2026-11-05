import { describe, expect, it } from 'vitest';
import { widgetRegistry } from '@/registry/registry';

/**
 * Every folder in src/widgets must follow the widget conventions (CLAUDE.md, prompt 4.0).
 * New widgets are picked up automatically by the globs below.
 */
const sources = import.meta.glob<string>('/src/widgets/*/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const components = import.meta.glob<{ default: unknown }>('/src/widgets/*/index.tsx');
const barrel = import.meta.glob<string>('/src/widgets/index.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})['/src/widgets/index.ts'];

const widgetNames = [
  ...new Set(
    Object.keys(sources).flatMap((path) => {
      const name = /^\/src\/widgets\/([^/]+)\//.exec(path)?.[1];
      return name ? [name] : [];
    }),
  ),
].sort();

const source = (path: string): string => sources[path] ?? '';
const REACT_MEMO = Symbol.for('react.memo');

/** Hex, rgb()/hsl() with literal numbers, and named colours in style-like positions. */
const HARD_CODED_COLOUR =
  /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b|\b(?:rgba?|hsla?)\(\s*\d|(?:fill|stroke|color|background)\s*[:=]\s*['"](?:white|black|red|green|blue|gray|grey|orange|yellow)['"]/;

describe('widget folder conventions', () => {
  it('has one folder per registered widget, named after its id', () => {
    const registered = widgetRegistry
      .getAllWidgets()
      .map((w) => w.id)
      .sort();
    expect(widgetNames).toEqual(registered);
  });

  describe.each(widgetNames)('%s', (name) => {
    const dir = `/src/widgets/${name}`;
    const definition = widgetRegistry.getWidget(name);

    it('has index.tsx, config.ts, types.ts and __tests__ with fixtures and a test', () => {
      for (const file of [
        'index.tsx',
        'config.ts',
        'types.ts',
        '__tests__/index.ts',
        `__tests__/${name}.test.tsx`,
      ]) {
        expect(sources, `${dir}/${file}`).toHaveProperty([`${dir}/${file}`]);
      }
    });

    it('is registered, with every WidgetDefinition field including maxSize', () => {
      expect(definition, 'registered under its folder name').toBeDefined();
      expect(barrel).toContain(`'./${name}/config'`);
      expect(definition?.maxSize).toBeDefined();
      expect(definition?.dataSource.endpoint).toBeTruthy();
    });

    it('lazy-loads a React.memo component from index.tsx', async () => {
      expect(source(`${dir}/config.ts`)).toContain("lazy(() => import('./index'))");
      const load = components[`${dir}/index.tsx`];
      if (!load) throw new Error(`${dir}/index.tsx missing`);
      const mod = await load();
      const component: unknown = mod.default;
      expect(typeof component === 'object' && component !== null && '$$typeof' in component).toBe(
        true,
      );
      if (typeof component === 'object' && component !== null && '$$typeof' in component) {
        expect(component.$$typeof).toBe(REACT_MEMO);
      }
    });

    it('uses theme colours only and imports D3 by sub-module', () => {
      for (const [path, text] of Object.entries(sources)) {
        if (!path.startsWith(`${dir}/`) || path.includes('/__tests__/')) continue;
        expect(HARD_CODED_COLOUR.exec(text)?.[0], `${path} hard-codes a colour`).toBeUndefined();
        expect(text, `${path} imports the whole of D3`).not.toMatch(/from 'd3'/);
      }
    });

    it('tests its ready, empty and error states', () => {
      expect(source(`${dir}/__tests__/${name}.test.tsx`)).toContain(
        `describeWidgetStates('${name}'`,
      );
    });
  });
});
