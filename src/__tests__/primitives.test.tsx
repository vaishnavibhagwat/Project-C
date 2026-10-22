import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { Dropdown, type DropdownItem } from '@/components/Dropdown';
import { IconSettings } from '@/components/Icons';
import { Tabs } from '@/components/Tabs';
import { Toggle } from '@/components/Toggle';
import { Tooltip } from '@/components/Tooltip';
import { spacingScale, STRUCTURAL_VARS } from '@/theme/tokens';

describe('design tokens', () => {
  const css = readFileSync(join(process.cwd(), 'src/theme/global.css'), 'utf8');

  it('defines every structural custom property in global.css', () => {
    for (const name of STRUCTURAL_VARS) expect(css).toMatch(new RegExp(`${name}:\\s*[^;]+;`));
    expect(css).toMatch(/--space-unit:\s*0\.25rem;/);
    expect(css).toMatch(/--color-bg:\s*11 14 19;/);
    expect(css).toMatch(/--color-panel:\s*17 23 32;/);
    expect(css).toMatch(/--color-text:\s*232 237 245;/);
  });

  it('maps Tailwind spacing, radii, dividers and fonts to the variables', () => {
    expect(spacingScale()['4']).toBe('calc(var(--space-unit) * 4)');
    expect(spacingScale()['0.5']).toBe('calc(var(--space-unit) * 0.5)');
    expect(spacingScale().px).toBe('var(--divider)');
    const theme = tailwindConfig.theme;
    expect(theme.spacing).toEqual(spacingScale());
    expect(theme.borderRadius).toMatchObject({ DEFAULT: 'var(--radius)', sm: 'var(--radius-sm)' });
    expect(theme.extend.borderWidth).toEqual({ DEFAULT: 'var(--divider)' });
    expect(theme.extend.fontFamily).toEqual({ sans: 'var(--font-sans)', mono: 'var(--font-mono)' });
  });
});

describe('Button', () => {
  it('offers sm, md and lg sizes', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('h-7');
    expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('h-9');
  });

  it('shows a spinner, sets aria-busy and ignores clicks while loading', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg.animate-spin')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Tooltip', () => {
  it('shows a described-by tooltip on keyboard focus and hides it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Refreshes every 5 s">
        {(tip) => (
          <button type="button" {...tip}>
            Refresh
          </button>
        )}
      </Tooltip>,
    );
    await user.tab();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Refreshes every 5 s');
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute(
      'aria-describedby',
      tooltip.id,
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('IconButton shows a decorative tooltip on hover and keeps its aria-label', async () => {
    render(<IconButton label="Configure" icon={IconSettings} />);
    const button = screen.getByRole('button', { name: 'Configure' });
    fireEvent.pointerEnter(button);
    const tip = await screen.findByText('Configure', { selector: 'span[aria-hidden="true"]' });
    expect(tip).toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-describedby');
    fireEvent.pointerLeave(button);
    expect(screen.queryByText('Configure', { selector: 'span' })).not.toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('is a switch that flips aria-checked and respects disabled', () => {
    function Harness({ disabled = false }: { disabled?: boolean }) {
      const [on, setOn] = useState(false);
      return <Toggle label="Live ticks" checked={on} onCheckedChange={setOn} disabled={disabled} />;
    }
    const { unmount } = render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Live ticks' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    unmount();
    render(<Harness disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Tabs', () => {
  function Harness() {
    const [tab, setTab] = useState<'grid' | 'theme' | 'data'>('grid');
    return (
      <Tabs
        label="Settings"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'grid', label: 'Grid', content: <p>Grid panel</p> },
          { value: 'theme', label: 'Theme', content: <p>Theme panel</p> },
          { value: 'data', label: 'Data', content: <p>Data panel</p> },
        ]}
      />
    );
  }

  it('selects with arrow keys, Home and End, keeping one tab in the Tab order', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Grid' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Theme' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Theme' })).toHaveTextContent('Theme panel');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Data' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ]);
  });
});

describe('Dropdown', () => {
  function setup(onSelect = vi.fn<(id: string) => void>()) {
    const items: DropdownItem[] = [
      { type: 'label', id: 'l', label: 'Dashboards' },
      {
        id: 'risk',
        label: 'Risk',
        checked: true,
        onSelect: () => {
          onSelect('risk');
        },
      },
      {
        id: 'holdings',
        label: 'Holdings',
        onSelect: () => {
          onSelect('holdings');
        },
      },
      { type: 'separator', id: 's' },
      {
        id: 'locked',
        label: 'Locked item',
        disabled: true,
        onSelect: () => {
          onSelect('locked');
        },
      },
      {
        id: 'performance',
        label: 'Performance',
        onSelect: () => {
          onSelect('performance');
        },
      },
    ];
    render(
      <Dropdown
        items={items}
        trigger={(props) => (
          <button type="button" {...props}>
            Dashboard
          </button>
        )}
      />,
    );
    return { onSelect, trigger: screen.getByRole('button', { name: 'Dashboard' }) };
  }

  it('opens on click with focus on the first item and closes on Escape', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Risk' })).toHaveFocus();
    expect(screen.getByRole('menuitemradio', { name: 'Risk' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('moves with arrows (skipping disabled items), wraps, and supports type-ahead', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Holdings' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Performance' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Risk' })).toHaveFocus();
    await user.keyboard('h');
    expect(screen.getByRole('menuitem', { name: 'Holdings' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Performance' })).toHaveFocus();
  });

  it('selects with Enter, closes and returns focus; ArrowUp on the trigger opens at the end', async () => {
    const user = userEvent.setup();
    const { onSelect, trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Performance' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('performance');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('ignores disabled items and closes on an outside click', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    const locked = screen.getByRole('menuitem', { name: 'Locked item' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    await user.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders text with a tone, never colour alone', () => {
    render(<Badge tone="warning">Simulated data</Badge>);
    expect(screen.getByText('Simulated data')).toHaveClass('text-warn', 'uppercase');
  });
});
