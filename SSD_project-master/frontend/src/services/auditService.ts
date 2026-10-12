/**
 * @fileoverview Audit log API service.
 * Wraps endpoints for fetching and exporting security audit logs. Admin only.
 */

import api from './api';
import { AuditLog, AuditLogFilters, AuditLogListResponse } from '../types/api';

const auditService = {
  /**
   * Fetch paginated audit logs with optional filtering.
   * Supports filtering by user, action, severity, IP address, and date range.
   */
  async getLogs(filters?: AuditLogFilters): Promise<AuditLogListResponse> {
    const response = await api.get<{
      success: boolean;
      data: AuditLogListResponse;
    }>('/audit/logs', { params: filters });
    return response.data.data as AuditLogListResponse;
  },

  /**
   * Export audit logs in the specified format.
   * Returns a blob for the browser to trigger a file download.
   * @param format - 'csv' or 'json'
   * @param filters - same filters as getLogs for scoped export
   */
  async exportLogs(
    format: 'csv' | 'json',
    filters?: Omit<AuditLogFilters, 'page' | 'limit'>
  ): Promise<Blob> {
    const response = await api.get('/audit/logs/export', {
      params: { ...filters, format },
      // tell axios to return the raw blob instead of parsing as json
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  /**
   * Fetch a single audit log entry by id for the expandable detail view.
   */
  async getLogById(id: string): Promise<AuditLog> {
    const response = await api.get<{ success: boolean; data: AuditLog }>(
      `/audit/logs/${id}`
    );
    return response.data.data as AuditLog;
  },
};

export default auditService;
