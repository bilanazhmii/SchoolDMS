"use client";

import {
  FC,
  useState,
} from 'react';

const Notifications: FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen((s) => !s)} className="h-9 w-9 rounded-md flex items-center justify-center text-slate-700 dark:text-slate-200">
        <span className="sr-only">Notifications</span>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-xs">3</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5">
          <div className="p-3 text-sm">
            <div className="font-semibold">Notifications</div>
            <ul className="mt-2 space-y-2">
              <li className="px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700">Document <strong>Budget Q2</strong> was shared with you.</li>
              <li className="px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700">Drive sync completed for <strong>Marketing</strong>.</li>
              <li className="px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700">New team member invited: <strong>Alice</strong>.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
