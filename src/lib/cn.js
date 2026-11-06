import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class lists, letting later Tailwind utilities override earlier ones. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
