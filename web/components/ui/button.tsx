"use client";

import * as React from 'react';

import {
  cva,
  type VariantProps,
} from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        ghost: 'bg-transparent text-foreground-muted hover:bg-surface-hover hover:text-foreground',
        outline: 'border border-border bg-transparent text-foreground hover:bg-surface-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-11 px-4 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  const variantClass = variant ?? 'default';
  const sizeClass = size ?? 'md';
  return <button ref={ref} className={cn(buttonVariants({ variant: variantClass, size: sizeClass }), className)} {...props} />;
});
Button.displayName = 'Button';

export default Button;
