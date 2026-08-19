"use client";

import {
  FC,
  useState,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ProfileDropdown: FC = () => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        aria-haspopup
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-1 ring-slate-100 dark:ring-transparent"
      >
        <span className="sr-only">Open user menu</span>
        <svg className="h-5 w-5 text-slate-700 dark:text-slate-200" viewBox="0 0 24 24" fill="none">
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            <Link href="/profile" className="block px-4 py-2 text-sm">Profile</Link>
            <Link href="/settings" className="block px-4 py-2 text-sm">Settings</Link>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); router.push('/login'); }} className="w-full text-left px-4 py-2 text-sm text-red-600">Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
