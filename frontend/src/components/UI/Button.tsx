'use client';

import { CircleNotchIcon } from '@phosphor-icons/react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode; // shown before the text. swapped for a spinner while loading
  loading?: boolean; // disables the button and shows a spinner
  fullWidth?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:bg-darkerAccent',
  secondary: 'border border-secondary-border bg-zinc-900 text-zinc-200 hover:bg-secondary-border hover:text-white',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  success: 'bg-green-600 text-white hover:bg-green-700',
};

const SIZES: Record<Size, string> = {
  sm: 'gap-1 rounded-md px-2 py-0.5 text-2xs',
  md: 'gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
  lg: 'gap-2 rounded-lg px-3 py-1.5 text-sm',
};

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  type = 'button', // not "submit": a Button inside a <form> shouldn't submit it by accident
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex cursor-pointer items-center justify-center font-medium transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <CircleNotchIcon size={size === 'sm' ? 12 : 16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
