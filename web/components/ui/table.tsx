"use client";

import * as React from 'react';

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50 dark:bg-slate-800">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="bg-white dark:bg-slate-900">{children}</tbody>;
}

export default Table;
