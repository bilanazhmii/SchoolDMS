"use client";

import * as Tabs from '@radix-ui/react-tabs';

export function TabsRoot({ children }: { children: React.ReactNode }) {
  return <Tabs.Root>{children}</Tabs.Root>;
}

export const TabsList = Tabs.List;
export const TabsTrigger = Tabs.Trigger;
export const TabsContent = Tabs.Content;

export default Tabs;
