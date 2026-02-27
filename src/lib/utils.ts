import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN");
}

export function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}
