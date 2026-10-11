import React from 'react';
import { clsx } from 'clsx';
import { COLORS } from "../../src/theme/colors";
interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', className }) => {
  return (
    <div
     style={{ borderTopColor: COLORS.primary.DEFAULT }}
      className={clsx(
        'animate-spin rounded-full border-2 border-gray-300 border-t-[var(--primary)]',
        {
          'h-4 w-4': size === 'sm',
          'h-6 w-6': size === 'md',
          'h-8 w-8': size === 'lg',
        },
        className
      )}
    />
  );
};
