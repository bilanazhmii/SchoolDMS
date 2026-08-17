"use client";

import { FC } from 'react';

import Link from 'next/link';

const Sidebar: FC = () => {
  return (
    <aside className="hidden md:flex md:flex-col w-72 min-w-[18rem] border-r bg-white dark:bg-slate-900 h-screen sticky top-0">
      <div className="p-4 flex-1 overflow-y-auto">
        <nav className="space-y-1">
          <Section title="Main">
            <NavItem href="/">Dashboard</NavItem>
            <NavItem href="/explorer">Explorer</NavItem>
            <NavItem href="/drive">Drive</NavItem>
          </Section>
        </nav>
      </div>
    </aside>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-3 py-2 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-slate-800">{children}</Link>
  );
}

export default Sidebar;
