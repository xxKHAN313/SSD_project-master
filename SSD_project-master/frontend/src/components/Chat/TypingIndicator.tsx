/**
 * @fileoverview Typing indicator component.
 * Shows which users are currently typing with an animated dot sequence.
 * Returns null when the typingUsers list is empty to avoid layout shift.
 */

import React from 'react';
import styles from './Chat.module.css';

interface TypingIndicatorProps {
  typingUsers: string[];
}

// build a human-readable string like "Alice is typing..." or "Alice and Bob are typing..."
function buildTypingLabel(users: string[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]} is typing`;
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing`;
  return 'Multiple people are typing';
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps): JSX.Element | null {
  if (typingUsers.length === 0) return null;

  return (
    <div className={styles.typingIndicator} aria-live="polite" aria-atomic="true">
      <span className={styles.typingDots} aria-hidden="true">
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
      </span>
      <span>{buildTypingLabel(typingUsers)}...</span>
    </div>
  );
}

export default TypingIndicator;
