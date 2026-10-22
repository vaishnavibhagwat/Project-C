import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Dropdown } from '@/components/Dropdown';
import { IconChevronDown, IconDownload, IconSave } from '@/components/Icons';

function DropdownDemo() {
  const [page, setPage] = useState('Workstation');
  const pages = ['Workstation', 'Risk', 'Holdings', 'Performance', 'Research & Alerts'];
  return (
    <div className="p-4 pb-80">
      <Dropdown
        width="w-64"
        items={[
          { type: 'label', id: 'dashboards', label: 'Dashboards' },
          ...pages.map((p) => ({
            id: p,
            label: p,
            checked: p === page,
            onSelect: () => setPage(p),
          })),
          { type: 'separator', id: 'sep' },
          { id: 'save', label: 'Save layout…', icon: IconSave, onSelect: () => undefined },
          {
            id: 'export',
            label: 'Export JSON',
            description: 'Disabled in this demo',
            icon: IconDownload,
            disabled: true,
            onSelect: () => undefined,
          },
        ]}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className="flex h-7 items-center gap-1.5 rounded border border-line bg-bg px-2 text-xs text-fg"
          >
            {page}
            <IconChevronDown size={12} />
          </button>
        )}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Dropdown',
  component: DropdownDemo,
} satisfies Meta<typeof DropdownDemo>;

export default meta;

/** Menu button: arrows, Home/End, type-ahead, Enter to choose, Escape to close. */
export const Default: StoryObj<typeof meta> = {};
