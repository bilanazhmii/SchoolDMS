"use client";

import {
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  CommandIcon,
  FileText,
  Folder,
  Search,
  User,
  X,
} from 'lucide-react';

import { Dialog, DialogContent } from './ui/dialog';

interface CommandItem {
  id: string;
  label: string;
  detail: string;
  icon: FC<{ className?: string }>;
  href: string;
}

const QUICK_ITEMS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', detail: 'View dashboard', icon: CommandIcon, href: '/' },
  { id: 'explorer', label: 'My Files', detail: 'Browse files', icon: Folder, href: '/explorer' },
  { id: 'drive', label: 'Google Drive', detail: 'Drive integration', icon: Folder, href: '/drive' },
  { id: 'settings', label: 'Settings', detail: 'App settings', icon: User, href: '/settings' },
];

const CommandPalette: FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('schooldms-recent-searches') ?? '[]');
      setRecent(Array.isArray(stored) ? stored : []);
    }
  }, []);

  const saveRecent = (q: string) => {
    const next: string[] = [q, ...recent.filter((r) => r !== q)].slice(0, 5);
    setRecent(next);
    localStorage.setItem('schooldms-recent-searches', JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return QUICK_ITEMS;
    return QUICK_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const handleSelect = (href: string, label: string) => {
    if (label) saveRecent(label);
    router.push(href);
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 shadow-xl max-w-xl bg-card border border-border">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="h-4 w-4 text-foreground-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-foreground-faint"
            autoFocus
          />
          <kbd className="text-2xs text-foreground-faint">ESC</kbd>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-surface-hover transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-1">
          <div className="text-2xs font-medium uppercase tracking-wider text-foreground-faint px-2 py-1.5 mb-1">
            {query.trim() ? 'Results' : 'Quick actions'}
          </div>
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.href, query.trim() ? item.label : '')}
                className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="h-7 w-7 rounded-md bg-surface-active flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-foreground-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.label}</div>
                  <div className="text-2xs text-foreground-faint truncate">{item.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        {!query.trim() && recent.length > 0 && (
          <div className="border-t border-border p-3">
            <div className="text-2xs font-medium uppercase tracking-wider text-foreground-faint mb-2">Recent searches</div>
            <div className="space-y-0.5">
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => handleSelect(`/explorer/search?q=${encodeURIComponent(r)}`, r)}
                  className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded hover:bg-surface-hover transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-foreground-faint" />
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
