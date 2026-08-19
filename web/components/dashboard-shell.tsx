"use client";

import {
  FC,
  ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import Breadcrumb from './breadcrumb';
import Navbar from './navbar';
import Sidebar from './sidebar';

const DashboardShell: FC<{
  children: ReactNode;
  contentClassName?: string;
}> = ({ children, contentClassName }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6', contentClassName)}>
            <Breadcrumb />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;