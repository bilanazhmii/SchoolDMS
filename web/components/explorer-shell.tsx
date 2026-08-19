"use client";

import { FC, ReactNode } from 'react';

import DashboardShell from './dashboard-shell';

const ExplorerShell: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <DashboardShell contentClassName="max-w-[1600px]">
      <div className="card">{children}</div>
    </DashboardShell>
  );
};

export default ExplorerShell;
