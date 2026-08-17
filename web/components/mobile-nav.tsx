"use client";

import { FC } from 'react';

import Sidebar from './sidebar';
import {
  SheetContent,
  SheetRoot,
  SheetTrigger,
} from './ui/sheet';

const MobileNav: FC = () => {
  return (
    <div className="md:hidden">
      <SheetRoot>
        <SheetTrigger>
          <button className="p-2 rounded-md">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </SheetTrigger>

        <SheetContent>
          <div className="p-4">
            <Sidebar />
          </div>
        </SheetContent>
      </SheetRoot>
    </div>
  );
};

export default MobileNav;
