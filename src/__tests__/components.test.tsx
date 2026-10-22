import { act, fireEvent, screen } from '@testing-library/react';
import type { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from '@/components/FormControls';
import { Modal } from '@/components/Overlay';
import { Popover } from '@/components/Popover';
import { SchemaForm } from '@/components/SchemaForm';
import { useToast } from '@/components/Toast';
import { InfoTooltip } from '@/components/Tooltip';
import { WidgetSkeleton } from '@/components/WidgetSkeleton';
import { ConfigPanel } from '@/grid/ConfigPanel';
import { configErrorsByField, validateWidgetConfig } from '@/registry/configValidator';
import type { SkeletonVariant } from '@/registry/defineWidget';
import { useWidgetStore } from '@/store/widgetStore';
import type { ConfigValue, WidgetConfig } from '@/types';
import { renderWithProviders } from './render';

const initialWidgets = useWidgetStore.getState();
beforeEach(() => useWidgetStore.setState(initialWidgets, true));

describe('SchemaForm', () => {
  const schema: JSONSchema7 = {
    type: 'object',
    properties: {
      range: { title: 'Range', oneOf: [{ const: '1Y' }, { const: '5Y' }] },
      show: { type: 'boolean', title: 'Show benchmark' },
      limit: { type: 'number', title: 'Limit', minimum: 1, maximum: 5 },
      label: { type: 'string', title: 'Label', maxLength: 10 },
    },
  };

  function Harness({ onChange }: { onChange: (k: string, v: ConfigValue) => void }) {
    const [value, setValue] = useState<WidgetConfig>({
      range: '1Y',
      show: false,
      limit: 2,
      label: 'a',
    });
    return (
      <SchemaForm
        schema={schema}
        value={value}
        errors={configErrorsByField(validateWidgetConfig(value, schema))}
        onChange={(k, v) => {
          onChange(k, v);
          setValue((s) => ({ ...s, [k]: v }));
        }}
      />
    );
  }

  it('renders a control per property and reports changes', () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '5Y' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Show benchmark' }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'desk' } });
    expect(onChange).toHaveBeenCalledWith('range', '5Y');
    expect(onChange).toHaveBeenCalledWith('show', true);
    expect(onChange).toHaveBeenCalledWith('label', 'desk');
  });

  it('shows validation errors inline', () => {
    renderWithProviders(<Harness onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '9' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Maximum is 5.');
    expect(screen.getByLabelText('Limit')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains when there is nothing to configure', () => {
    renderWithProviders(<SchemaForm schema={{ type: 'object' }} value={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/no configurable settings/)).toBeInTheDocument();
  });
});

describe('ConfigPanel', () => {
  const id = 'workstation-var-gauge';

  it('edits a draft and applies it on Save', () => {
    act(() => useWidgetStore.getState().openSettings(id));
    renderWithProviders(<ConfigPanel />);
    expect(screen.getByRole('dialog', { name: /Configure · Value at Risk/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confidence level'), { target: { value: '95' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Desk VaR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const inst = useWidgetStore.getState().instances[id];
    expect(inst?.config.confidence).toBe('95');
    expect(inst?.title).toBe('Desk VaR');
    expect(useWidgetStore.getState().settingsFor).toBeNull();
  });

  it('blocks Save while a value is invalid, and can reset to defaults', () => {
    act(() => useWidgetStore.getState().openSettings(id));
    renderWithProviders(<ConfigPanel />);
    fireEvent.change(screen.getByLabelText('VaR limit (% of AUM)'), { target: { value: '99' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('closes with Cancel without changing the widget', () => {
    act(() => useWidgetStore.getState().openSettings(id));
    renderWithProviders(<ConfigPanel />);
    fireEvent.change(screen.getByLabelText('Confidence level'), { target: { value: '95' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useWidgetStore.getState().instances[id]?.config).toEqual({});
  });
});

describe('overlays', () => {
  it('Modal closes on Escape and traps focus inside', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open onClose={onClose} title="Dialog">
        <button type="button">Inside</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Dialog' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Popover opens on click and closes on outside pointer', () => {
    renderWithProviders(
      <div>
        <Popover label="Menu" trigger={(p) => <button {...p}>Open</button>}>
          {() => <p>Menu body</p>}
        </Popover>
        <span>outside</span>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('InfoTooltip appears on focus with an accessible description', () => {
    renderWithProviders(<InfoTooltip content="Explains the metric" label="About X" />);
    fireEvent.focus(screen.getByRole('button', { name: 'About X' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explains the metric');
    expect(screen.getByRole('button', { name: 'About X' })).toHaveAccessibleDescription(
      'Explains the metric',
    );
  });
});

describe('Segmented', () => {
  it('moves selection with arrow keys', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <Segmented
        label="Range"
        value="1Y"
        options={[
          { value: '1Y', label: '1Y' },
          { value: '3Y', label: '3Y' },
        ]}
        onValueChange={onChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Range' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('3Y');
  });
});

describe('toasts', () => {
  function Trigger() {
    const notify = useToast();
    return (
      <button
        type="button"
        onClick={() => notify({ message: 'Saved', action: { label: 'Undo', onClick: undoSpy } })}
      >
        go
      </button>
    );
  }
  const undoSpy = vi.fn();

  it('shows a message with an action', () => {
    renderWithProviders(<Trigger />);
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undoSpy).toHaveBeenCalled();
  });
});

describe('WidgetSkeleton', () => {
  const variants: SkeletonVariant[] = [
    'line-chart',
    'area-chart',
    'donut',
    'bars',
    'table',
    'feed',
    'gauge',
    'tiles',
    'heatmap',
    'treemap',
  ];
  it.each(variants)('renders a %s-shaped placeholder hidden from assistive tech', (variant) => {
    renderWithProviders(<WidgetSkeleton variant={variant} />);
    const el = screen.getByTestId(`skeleton-${variant}`);
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
