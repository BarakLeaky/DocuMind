import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "@/components/status-badge";
import { PROCESSING_STATES } from "@/lib/constants";

const meta = { title: "Documents/StatusBadge", component: StatusBadge } satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { status: "ready" } };
export const Processing: Story = { args: { status: "ocr" } };
export const Failed: Story = { args: { status: "failed" } };

export const AllStates: Story = {
  args: { status: "ready" },
  render: () => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {PROCESSING_STATES.map((s) => <StatusBadge key={s} status={s} />)}
    </div>
  ),
};
