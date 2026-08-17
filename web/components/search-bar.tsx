"use client";

import { FC, FormEvent, useState } from 'react';

import { useRouter } from 'next/navigation';

const SearchBar: FC = () => {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/explorer/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <form onSubmit={submit} className="relative">
      <label htmlFor="search" className="sr-only">Search</label>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
        </svg>
      </div>
      <input
        id="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search documents, teams, files..."
        className="w-full rounded-md border border-slate-200 bg-white px-10 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </form>
  );
};

export default SearchBar;
