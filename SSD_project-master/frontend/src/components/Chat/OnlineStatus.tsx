/**
 * @fileoverview Online status indicator component.
 * Shows a colored dot and optional text label for a user's connection state.
 */

import React from 'react';
import styles from './Chat.module.css';

interface OnlineStatusProps {
  isOnline: boolean;
  // when true, renders "Online" or "Offline" text next to the dot
  showLabel?: boolean;
}

export function OnlineStatus({ isOnline, showLabel = false }: OnlineStatusProps): JSX.Element {
  return (
    <span className={styles.onlineStatus} aria-label={isOnline ? 'Online' : 'Offline'}>
      <span
        className={`${styles.onlineIndicator} ${
          isOnline ? styles.onlineIndicatorOnline : styles.onlineIndicatorOffline
        }`}
      />
      {showLabel && (
        <span className={styles.onlineLabel}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </span>
  );
}

export default OnlineStatus;
