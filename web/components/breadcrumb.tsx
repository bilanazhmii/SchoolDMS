"use client";

import { FC } from 'react';

import Link from 'next/link';

import { ChevronRight, Home } from 'lucide-react';

import { cn } from '../lib/utils';

export type BreadcrumbItem = { label: string; href?: string };

const Breadcrumb: FC<{ items?: BreadcrumbItem[] }> = ({ items }) => {
  const crumbs: BreadcrumbItem[] = items && items.length > 0 ? items : [{ label: 'Dashboard' }];

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-2xs text-foreground-muted">
        <li className="flex items-center">
          <Link href="/" className="text-foreground-muted hover:text-foreground transition-colors">
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>

        {crumbs.map((it, idx) => (
          <li key={`${it.label}-${idx}`} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-foreground-faint" />
            {idx < crumbs.length - 1 || !it.href ? (
              <span className={cn('truncate', idx === crumbs.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground')}>
                {it.label}
              </span>
            ) : (
              <Link href={it.href} className="truncate hover:text-foreground transition-colors">
                {it.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
