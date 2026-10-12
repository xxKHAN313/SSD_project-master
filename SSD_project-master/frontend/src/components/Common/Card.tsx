/**
 * @fileoverview Reusable Card component.
 * A white container with configurable shadow, padding, and an optional header with action.
 */

import React, { ReactNode, HTMLAttributes } from 'react';
import styles from './Common.module.css';

export type CardShadow = 'none' | 'subtle' | 'soft' | 'medium' | 'large';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  // optional element rendered in the card header's top-right corner (e.g., a button)
  action?: ReactNode;
  shadow?: CardShadow;
  padding?: CardPadding;
  children?: ReactNode;
}

const shadowClassMap: Record<CardShadow, string> = {
  none: styles.cardShadowNone,
  subtle: styles.cardShadowSubtle,
  soft: styles.cardShadowSoft,
  medium: styles.cardShadowMedium,
  large: styles.cardShadowLarge,
};

const paddingClassMap: Record<CardPadding, string> = {
  none: styles.cardPaddingNone,
  sm: styles.cardPaddingSm,
  md: styles.cardPaddingMd,
  lg: styles.cardPaddingLg,
};

export function Card({
  title,
  subtitle,
  action,
  shadow = 'soft',
  padding = 'md',
  children,
  className,
  ...rest
}: CardProps): JSX.Element {
  const classNames = [
    styles.card,
    shadowClassMap[shadow],
    !title ? paddingClassMap[padding] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} {...rest}>
      {/* render header section only if title, subtitle, or action are provided */}
      {(title || subtitle || action) && (
        <div
          className={styles.cardHeader}
          style={{
            padding:
              padding !== 'none'
                ? paddingClassMap[padding] === styles.cardPaddingSm
                  ? 'var(--space-md)'
                  : padding === 'lg'
                  ? 'var(--space-xl)'
                  : 'var(--space-lg)'
                : 'var(--space-lg)',
            paddingBottom: 0,
          }}
        >
          <div>
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      {/* main content area - apply padding class when title is shown */}
      <div
        style={
          title || subtitle || action
            ? {
                padding:
                  padding === 'sm'
                    ? 'var(--space-md)'
                    : padding === 'lg'
                    ? 'var(--space-xl)'
                    : padding === 'none'
                    ? '0'
                    : 'var(--space-lg)',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

export default Card;
