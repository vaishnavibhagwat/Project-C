import type { Meta, StoryObj } from '@storybook/react';
import * as Icons from '@/components/Icons';

const entries = Object.entries(Icons).filter(([name]) => name.startsWith('Icon'));

function IconGallery() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {entries.map(([name, Icon]) =>
        typeof Icon === 'function' ? (
          <li
            key={name}
            className="flex items-center gap-2 rounded border border-line p-2 text-xs text-muted"
          >
            <Icon size={18} />
            {name.replace('Icon', '')}
          </li>
        ) : null,
      )}
    </ul>
  );
}

const meta = { title: 'Components/Icons', component: IconGallery } satisfies Meta<
  typeof IconGallery
>;
export default meta;
export const Gallery: StoryObj<typeof meta> = {};
