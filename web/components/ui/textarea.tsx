"use client";

import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${className ?? ''}`}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export default Textarea;
