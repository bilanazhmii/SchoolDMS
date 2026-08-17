"use client";

import * as Tooltip from '@radix-ui/react-tooltip';

export function TooltipRoot({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}

export const TooltipTrigger = Tooltip.Trigger;
export const TooltipContent = ({ children }: { children: React.ReactNode }) => (
  <Tooltip.Portal>
    <Tooltip.Content className="rounded bg-black text-white px-2 py-1 text-xs">{children}</Tooltip.Content>
  </Tooltip.Portal>
);

export default Tooltip;
