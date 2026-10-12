/**
 * @fileoverview Audit logs data table.
 * Columns: Timestamp, User, Action, Severity badge, IP Address, expandable Details.
 * Clicking a row expands it to show the raw JSON details payload.
 */

import React, { useState } from 'react';
import styles from './Admin.module.css';
import { AuditLog } from '../../types/api';

interface LogsTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function severityClass(sev: AuditLog['severity']): string {
  switch (sev) {
    case 'critical': return styles.badgeCritical;
    case 'warning': return styles.badgeWarning;
    default: return styles.badgeInfo;
  }
}

export function LogsTable({
  logs,
  isLoading,
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: LogsTableProps): JSX.Element {
  // tracks which row is currently expanded by id
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} aria-label="Audit logs table">
        <thead className={styles.tableHead}>
          <tr>
            <th style={{ width: '160px' }}>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th style={{ width: '100px' }}>Severity</th>
            <th style={{ width: '130px' }}>IP Address</th>
            <th style={{ width: '40px' }} aria-label="Expand details" />
          </tr>
        </thead>

        <tbody className={styles.tableBody}>
          {isLoading
            ? [...Array(8)].map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  {[...Array(6)].map((__, j) => (
                    <td key={j}>
                      <div className={styles.skeletonLine} style={{ width: `${50 + j * 8}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            : logs.length === 0
            ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <span className={styles.emptyStateIcon}>📋</span>
                    <span>No audit logs found matching your filters.</span>
                  </div>
                </td>
              </tr>
            )
            : logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => hasDetails && toggleExpand(log.id)}
                      style={{ cursor: hasDetails ? 'pointer' : 'default' }}
                      aria-expanded={hasDetails ? isExpanded : undefined}
                    >
                      <td
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                        {log.username}
                      </td>
                      <td style={{ color: 'var(--color-text-primary)' }}>
                        {log.action}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${severityClass(log.severity)}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {log.ipAddress}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        {hasDetails && (
                          <span aria-hidden="true" style={{ fontSize: '12px' }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* expandable details row */}
                    {isExpanded && hasDetails && (
                      <tr className={styles.expandedRow}>
                        <td colSpan={6}>
                          <div className={styles.expandedContent}>
                            {JSON.stringify(log.details, null, 2)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
        </tbody>
      </table>

      {/* pagination footer */}
      {!isLoading && total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Showing {startItem}–{endItem} of {total} logs
          </span>
          <div className={styles.paginationButtons}>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              aria-label="First page"
            >
              «
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              ‹
            </button>

            {/* show page numbers around the current page */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = startPage + i;
              return (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}

            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              ›
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogsTable;
