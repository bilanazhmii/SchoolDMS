"use client";

import { FC } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import DriveStatus from './drive-status';
import MobileNav from './mobile-nav';
import Notifications from './notifications';
import ProfileDropdown from './profile-dropdown';
import SearchBar from './search-bar';
import StorageWidget from './storage-widget';

const Navbar: FC = () => {
  return (
    <header className="w-full border-b bg-white dark:bg-slate-900/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <MobileNav />
            <Link href="/" className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-200">
                <Image src="/schooldms-mark.png" alt="SchoolDMS" width={36} height={36} className="h-9 w-9 object-contain" priority />
              </div>

              <div className="hidden sm:block">
                <div className="text-sm font-semibold">SchoolDMS</div>
                <div className="text-xs text-muted-foreground">Enterprise Document Management</div>
              </div>
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <SearchBar />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex md:items-center md:gap-3">
              <StorageWidget />
              <DriveStatus />
            </div>
            <Notifications />
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
