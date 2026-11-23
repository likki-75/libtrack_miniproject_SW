import React, { useCallback, useEffect, useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, History } from 'lucide-react';
import { borrowApi } from '../lib/api';
import { useToast } from './ui/Toast';
import type { BorrowRecord, User } from '../types';

interface BorrowingHistoryViewProps {
  user: User;
  currencySymbol: string;
}

export function BorrowingHistoryView({ user, currencySymbol }: BorrowingHistoryViewProps) {
  const { showToast } = useToast();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('issueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await borrowApi.records({
        search: search.trim(),
        status: statusFilter,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      setRecords(res.records);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      showToast('error', 'Failed to load history', err instanceof Error ? err.message : 'Server error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder, page, pageSize, showToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportCsv = () => {
    const header = [
      'Record ID',
      'Student ID',
      'Student Name',
      'Book ID',
      'Book Title',
      'Issue Date',
      'Due Date',
      'Return Date',
      'Status',
      'Overdue Days',
      'Fine',
    ];
    const rows = records.map((r) => [
      r.recordId,
      r.studentId,
      `"${r.studentName.replace(/"/g, '""')}"`,
      r.bookId,
      `"${r.bookTitle.replace(/"/g, '""')}"`,
      r.issueDate,
      r.dueDate,
      r.returnDate ?? '',
      r.status,
      String(r.overdueDays),
      String(r.fineAmount),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `libtrack-borrowing-history-p${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search record ID, student, book, or ISBN..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {['All', 'Borrowed', 'Overdue', 'Returned'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort history by"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="issueDate">Sort: Issue Date</option>
            <option value="dueDate">Sort: Due Date</option>
            <option value="returnDate">Sort: Return Date</option>
            <option value="overdueDays">Sort: Overdue Days</option>
            <option value="fineAmount">Sort: Fine</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            aria-label="Toggle sort order"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900">No borrowing records</h3>
            <p className="mt-1 text-sm text-slate-500">
              {user.role === 'student'
                ? 'Books issued to your student ID will appear here.'
                : 'Try clearing filters or issuing a book to create a borrowing record.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Book</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Return Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Overdue</th>
                  <th className="py-3 px-4 text-right">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records.map((rec) => (
                  <tr key={rec.recordId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {rec.recordId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-900">{rec.studentName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{rec.studentId}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[220px]">
                      <p className="text-xs font-medium text-slate-900 truncate">{rec.bookTitle}</p>
                      <p className="text-[11px] font-mono text-slate-500">{rec.bookId}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {rec.issueDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {rec.dueDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {rec.returnDate ?? '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          rec.status === 'Overdue'
                            ? 'text-red-600'
                            : rec.status === 'Returned'
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {rec.overdueDays}d
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {currencySymbol}
                      {rec.fineAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
          <span className="tabular-nums">
            Showing page {page} of {totalPages} ({total} total records)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
