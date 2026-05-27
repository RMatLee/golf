import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind class names, resolving conflicts so the last class wins.
 * Accepts any mix of strings, arrays, and conditional objects (clsx syntax).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
