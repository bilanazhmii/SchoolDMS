'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONSENT_COOKIE = 'schooldms_cookie_consent';

function readConsent() {
  return document.cookie.split('; ').some((entry) => entry.startsWith(`${CONSENT_COOKIE}=`));
}

function saveConsent(value: 'accepted' | 'necessary') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());
  }, []);

  if (!visible) return null;

  const accept = (value: 'accepted' | 'necessary') => {
    saveConsent(value);
    setVisible(false);
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:mx-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Privacy and cookies</h2>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">SchoolDMS uses essential HttpOnly session cookies to keep you signed in. Optional preference cookies only remember this choice. Read our <Link href="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link> and <Link href="/cookies" className="font-medium text-primary hover:underline">Cookie Policy</Link>.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => accept('necessary')} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground-muted hover:bg-surface-hover">Necessary only</button>
          <button type="button" onClick={() => accept('accepted')} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">Accept preferences</button>
        </div>
      </div>
    </aside>
  );
}
