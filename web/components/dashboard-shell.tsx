"use client";

import {
  FC,
  ReactNode,
} from 'react';

import Breadcrumb from './breadcrumb';
import Navbar from './navbar';
import Sidebar from './sidebar';

const DashboardShell: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Breadcrumb />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;