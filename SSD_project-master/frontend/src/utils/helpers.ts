/**
 * @fileoverview General-purpose utility helper functions.
 * Date formatting, string manipulation, debounce/throttle, and UI helpers.
 */

import { UserRole } from '../types';
import React from 'react';

/**
 * Format an ISO date string to a localized, human-readable format.
 * Example: "April 17, 2026 at 3:45 PM"
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date as a short string for use in compact displays.
 * Example: "Apr 17" or "3:45 PM" if today, "Apr 17" if this year.
 */
export function formatShortDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (isThisYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Format a timestamp as a relative time string ("just now", "5 minutes ago", etc.).
 * Used for message timestamps and last-seen indicators.
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 30) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatShortDate(isoString);
  } catch {
    return '';
  }
}

/**
 * Get initials from a name or username for use in avatar placeholders.
 * "John Doe" → "JD", "alice" → "AL", "john_doe" → "JD"
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  // replace underscores with spaces so usernames like john_doe split properly
  const parts = name.replace(/_/g, ' ').trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get the display color for a role badge.
 */
export function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '#7C3AED'; // purple
    case 'manager':
      return '#2563EB'; // blue
    case 'employee':
      return '#059669'; // green
    default:
      return '#6B7280'; // gray
  }
}

/**
 * Get inline style object for a role badge element.
 */
export function getRoleBadgeStyle(role: UserRole): React.CSSProperties {
  const color = getRoleColor(role);
  return {
    backgroundColor: `${color}18`, // 10% opacity background
    color,
    border: `1px solid ${color}40`, // 25% opacity border
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  };
}


/**
 * Generate a consistent avatar background color from a username string.
 * Uses a simple hash so the same username always gets the same color.
 */
export function generateAvatarColor(username: string): string {
  const colors = [
    '#2563EB', '#7C3AED', '#DB2777', '#DC2626',
    '#D97706', '#059669', '#0891B2', '#4F46E5',
    '#7C2D12', '#166534',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // convert to 32-bit int
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Create a debounced version of a function.
 * The function is only called after `delay` ms have passed with no new calls.
 * @param fn - the function to debounce
 * @param delay - milliseconds to wait
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a throttled version of a function.
 * The function is called at most once per `limit` ms.
 * @param fn - the function to throttle
 * @param limit - minimum milliseconds between calls
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Format a number with thousands separators.
 * Example: 1234567 → "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
