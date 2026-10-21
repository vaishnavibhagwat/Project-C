import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/Button';
import { IconPlus, IconSave } from '@/components/Icons';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Add widget', variant: 'secondary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary', icon: IconPlus } };
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" icon={IconPlus}>
        Primary
      </Button>
      <Button icon={IconSave}>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button size="sm">Small</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
