"use client";

import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`block w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${className ?? ''}`}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export default Input;
