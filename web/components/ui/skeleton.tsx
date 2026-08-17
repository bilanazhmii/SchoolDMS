export default function Skeleton({ className = 'h-4 bg-slate-100 dark:bg-slate-700 rounded' }: { className?: string }) {
  return <div className={`${className} animate-pulse`} />;
}
