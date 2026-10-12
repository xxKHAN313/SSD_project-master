/**
 * @fileoverview Audit logs viewer page.
 * Filters, paginates, auto-refreshes, and exports audit log entries.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Admin.module.css';
import MainLayout from '../Layout/MainLayout';
import Button from '../Common/Button';
import LogsTable from './LogsTable';
import { useAppContext } from '../../store/appContext';
import auditService from '../../services/auditService';
import { AuditLog, AuditLogListResponse } from '../../types/api';

const PAGE_LIMIT = 25;
// auto-refresh interval in milliseconds
const REFRESH_INTERVAL = 30_000;

interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  action: string;
  severity: AuditLog['severity'] | '';
}

// trigger a blob download in the browser
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AuditLogsViewer(): JSX.Element {
  const { addToast } = useAppContext();

  const [logsResp, setLogsResp] = useState<AuditLogListResponse>({
    logs: [],
    total: 0,
    page: 1,
    limit: PAGE_LIMIT,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    startDate: '',
    endDate: '',
    action: '',
    severity: '',
  });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(
    async (p: number) => {
      setIsLoading(true);
      try {
        const resp = await auditService.getLogs({
          page: p,
          limit: PAGE_LIMIT,
          search: filters.search || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          action: filters.action || undefined,
          severity: filters.severity || undefined,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        });
        setLogsResp(resp);
      } catch {
        addToast('error', 'Failed to fetch audit logs.');
      } finally {
        setIsLoading(false);
      }
    },
    [filters, addToast]
  );

  // fetch whenever page or filters change
  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  // manage auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        fetchLogs(page);
      }, REFRESH_INTERVAL);
    } else {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, page, fetchLogs]);

  const handleFilterChange = (field: keyof Filters) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
    // reset to first page when filters change
    setPage(1);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const blob = await auditService.exportLogs(format, {
        search: filters.search || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        action: filters.action || undefined,
        severity: filters.severity || undefined,
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `audit-logs-${date}.${format}`);
      addToast('success', `Logs exported as ${format.toUpperCase()}.`);
    } catch {
      addToast('error', 'Failed to export logs.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout>
      <div>
        {/* page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Audit Logs</h1>
            <p className={styles.pageSubtitle}>
              Security event history — {logsResp.total.toLocaleString()} total records
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* auto-refresh toggle */}
            <label className={styles.autoRefreshToggle}>
              <button
                className={`${styles.toggleSwitch} ${autoRefresh ? styles.toggleSwitchOn : ''}`}
                onClick={() => setAutoRefresh((v) => !v)}
                aria-pressed={autoRefresh}
                aria-label="Toggle auto-refresh"
              >
                <div className={`${styles.toggleKnob} ${autoRefresh ? styles.toggleKnobOn : ''}`} />
              </button>
              Auto-refresh (30s)
            </label>

            {/* manual refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(page)}
              disabled={isLoading}
              iconLeft={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                </svg>
              }
            >
              Refresh
            </Button>

            {/* export dropdown */}
            <div className={styles.exportWrapper}>
              <Button
                variant="primary"
                size="sm"
                loading={isExporting}
                onClick={() => setShowExportMenu((v) => !v)}
                iconRight={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                }
              >
                Export
              </Button>
              {showExportMenu && (
                <div className={styles.exportDropdown}>
                  <button className={styles.exportOption} onClick={() => handleExport('csv')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Export CSV
                  </button>
                  <button className={styles.exportOption} onClick={() => handleExport('json')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Export JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* filter row */}
        <div className={styles.filterRow}>
          <input
            type="search"
            className={styles.filterInput}
            placeholder="Search by username, action, or IP..."
            value={filters.search}
            onChange={handleFilterChange('search')}
            aria-label="Search audit logs"
          />

          <div className={styles.filterDateRange}>
            <span className={styles.filterDateLabel}>From</span>
            <input
              type="date"
              className={styles.filterInput}
              style={{ minWidth: '140px', flex: 'unset' }}
              value={filters.startDate}
              onChange={handleFilterChange('startDate')}
              aria-label="Start date filter"
            />
            <span className={styles.filterDateLabel}>to</span>
            <input
              type="date"
              className={styles.filterInput}
              style={{ minWidth: '140px', flex: 'unset' }}
              value={filters.endDate}
              onChange={handleFilterChange('endDate')}
              aria-label="End date filter"
            />
          </div>

          <select
            className={styles.filterSelect}
            value={filters.action}
            onChange={handleFilterChange('action')}
            aria-label="Filter by action type"
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="register">Register</option>
            <option value="role_change">Role Change</option>
            <option value="user_deactivated">User Deactivated</option>
            <option value="message_deleted">Message Deleted</option>
            <option value="failed_login">Failed Login</option>
          </select>

          <select
            className={styles.filterSelect}
            value={filters.severity}
            onChange={handleFilterChange('severity')}
            aria-label="Filter by severity"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* audit logs table */}
        <LogsTable
          logs={logsResp.logs}
          isLoading={isLoading}
          page={page}
          totalPages={logsResp.totalPages}
          total={logsResp.total}
          limit={PAGE_LIMIT}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </MainLayout>
  );
}

export default AuditLogsViewer;
