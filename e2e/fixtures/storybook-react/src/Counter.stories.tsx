import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import { Counter } from './Counter';

const meta = {
  title: 'Counter',
  component: Counter,
  args: { label: 'Count', onChange: fn() },
} satisfies Meta<typeof Counter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(
      canvas.getByRole('status', { name: 'Count' }),
    ).toHaveTextContent('1');
    await expect(args.onChange).toHaveBeenCalledWith(1);
  },
};

export const Wrapped: Story = {
  args: { label: 'Wrapped' },
  render: (args) => (
    <section aria-label="Wrapped counter">
      <Counter {...args} />
    </section>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('status', { name: 'Wrapped' }),
    ).toHaveTextContent('0');
    await expect(
      canvas.getByRole('region', { name: 'Wrapped counter' }),
    ).toBeVisible();
  },
};
