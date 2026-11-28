import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import { PingPanel } from './Pinger';

const meta = {
  title: 'PingPanel',
  component: PingPanel,
  args: { reply: fn().mockReturnValue('pong') },
} satisfies Meta<typeof PingPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Replies: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'idle' }));
    await expect(canvas.getByRole('button', { name: 'pong' })).toBeVisible();
  },
};
