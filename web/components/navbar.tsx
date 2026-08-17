"use client";

import { FC } from 'react';

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
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold">S</div>
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
