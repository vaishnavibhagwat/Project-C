import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';

function ToastDemo() {
  const notify = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => notify({ message: 'Widget settings saved', tone: 'success' })}>
        Success
      </Button>
      <Button
        onClick={() =>
          notify({
            message: 'Removed “Holdings”',
            action: { label: 'Undo', onClick: () => notify({ message: 'Restored' }) },
          })
        }
      >
        With undo
      </Button>
      <Button onClick={() => notify({ message: 'Could not copy link', tone: 'error' })}>
        Error
      </Button>
    </div>
  );
}

/** Toasts come from ToastProvider, applied to every story by the global decorator. */
const meta = { title: 'Components/Toast', component: ToastDemo } satisfies Meta<typeof ToastDemo>;

export default meta;
export const Default: StoryObj<typeof meta> = {};
