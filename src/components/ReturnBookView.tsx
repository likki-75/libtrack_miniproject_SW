import React, { useCallback, useEffect, useState } from 'react';
import { BookCheck, Search, AlertCircle, CheckCircle2, Calculator } from 'lucide-react';
import { borrowApi } from '../lib/api';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { BorrowRecord, LibrarySettings, ReturnPreview } from '../types';

interface ReturnBookViewProps {
  settings: LibrarySettings;
}

function getTodayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ReturnBookView({ settings }: ReturnBookViewProps) {
  const { showToast } = useToast();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedRecord, setSelectedRecord] = useState<BorrowRecord | null>(null);
  const [returnDate, setReturnDate] = useState(getTodayLocal());
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<ReturnPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchActiveRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await borrowApi.records({
        status: 'Active',
        search: search.trim(),
        sortBy: 'dueDate',
        sortOrder: 'asc',
        page: 1,
        pageSize: 50,
      });
      setRecords(res.records);
    } catch (err) {
      showToast('error', 'Load failed', err instanceof Error ? err.message : 'Unable to load borrowed books.');
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    fetchActiveRecords();
  }, [fetchActiveRecords]);

  useEffect(() => {
    if (!selectedRecord) {
      setPreview(null);
      setPreviewError('');
      return;
    }
    let active = true;
    setPreviewLoading(true);
    setPreviewError('');
    borrowApi
      .previewReturn({ recordId: selectedRecord.recordId, returnDate })
      .then((res) => {
        if (active) setPreview(res.preview);
      })
      .catch((err) => {
        if (active) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : 'Invalid return date.');
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRecord, returnDate]);

  const handleSelectRecord = (rec: BorrowRecord) => {
    setSelectedRecord(rec);
    const today = getTodayLocal();
    setReturnDate(today >= rec.issueDate ? today : rec.issueDate);
    setNotes('');
  };

  const executeReturn = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      const res = await borrowApi.returnBook({
        recordId: selectedRecord.recordId,
        returnDate,
        notes: notes.trim(),
      });
      showToast(
        'success',
        'Book returned',
        `"${res.record.bookTitle}" returned. Overdue: ${res.record.overdueDays} day(s), Fine: ${settings.currencySymbol}${res.record.fineAmount.toFixed(2)}.`
      );
      setConfirmOpen(false);
      setSelectedRecord(null);
      setPreview(null);
      await fetchActiveRecords();
    } catch (err) {
      showToast('error', 'Return failed', err instanceof Error ? err.message : 'Unable to return book.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Active Borrowed Books List */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Active Borrowed Books</h2>
            <p className="text-xs text-slate-500">Select a borrowing record to calculate fine and process return.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              data-testid="return-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, book, or ID..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900">No active borrowed books</h3>
            <p className="mt-1 text-sm text-slate-500">All issued books have been returned.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="active-borrows-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Record</th>
                  <th className="py-3 px-4">Book</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records.map((rec) => {
                  const isSelected = selectedRecord?.recordId === rec.recordId;
                  const isOverdue = rec.status === 'Overdue';
                  return (
                    <tr
                      key={rec.recordId}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {rec.recordId}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <p className="font-medium text-slate-900 truncate">{rec.bookTitle}</p>
                        <p className="text-xs font-mono text-slate-500">{rec.bookId}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-900 text-xs font-medium">{rec.studentName}</p>
                        <p className="text-[11px] font-mono text-slate-500">{rec.studentId}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {rec.dueDate}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            isOverdue ? 'text-red-600' : 'text-blue-700'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          data-testid={`select-return-${rec.recordId}`}
                          onClick={() => handleSelectRecord(rec)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right Fine Calculator & Return Confirmation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          <h3 className="font-display text-base font-semibold text-slate-900">Return &amp; Fine Calculator</h3>
        </div>

        {!selectedRecord ? (
          <div className="py-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg px-4">
            Choose an active borrowing record from the table to preview overdue days and calculate fine.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
              <p className="font-semibold text-slate-900">{selectedRecord.bookTitle}</p>
              <p className="text-slate-600">
                Borrower: {selectedRecord.studentName} · <span className="font-mono">{selectedRecord.studentId}</span>
              </p>
              <p className="font-mono text-slate-500">
                Record {selectedRecord.recordId} · Issued {selectedRecord.issueDate}
              </p>
            </div>

            <div>
              <label htmlFor="return-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Return Date
              </label>
              <input
                id="return-date"
                data-testid="return-date-input"
                type="date"
                min={selectedRecord.issueDate}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="return-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Return Notes / Condition
              </label>
              <input
                id="return-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Returned in good condition"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {previewError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{previewError}</span>
              </div>
            )}

            {previewLoading ? (
              <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
            ) : (
              preview && (
                <div className="rounded-lg border border-slate-200 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-mono text-slate-900">{preview.dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Overdue Days</span>
                    <span
                      data-testid="preview-overdue-days"
                      className={`font-mono font-semibold tabular-nums ${
                        preview.overdueDays > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {preview.overdueDays} day(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Configured Rate</span>
                    <span className="font-mono text-slate-700">
                      {preview.currencySymbol}
                      {preview.finePerOverdueDay.toFixed(2)} / day
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm">
                    <span className="font-semibold text-slate-900">Calculated Fine</span>
                    <span
                      data-testid="preview-fine-amount"
                      className={`font-mono font-bold tabular-nums ${
                        preview.fineAmount > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {preview.currencySymbol}
                      {preview.fineAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            )}

            <button
              type="button"
              data-testid="confirm-return-btn"
              disabled={!preview || Boolean(previewError) || submitting}
              onClick={() => {
                if (preview && preview.fineAmount > 0) {
                  setConfirmOpen(true);
                } else {
                  executeReturn();
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <BookCheck className="h-4 w-4" />
              {submitting ? 'Processing Return...' : 'Confirm Book Return'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeReturn}
        loading={submitting}
        variant="primary"
        title="Confirm Overdue Book Return & Fine"
        message={
          preview
            ? `This book is ${preview.overdueDays} day(s) overdue with a calculated fine of ${preview.currencySymbol}${preview.fineAmount.toFixed(
                2
              )}. Confirm recording the return and storing the fine in the database?`
            : ''
        }
        confirmLabel="Record Return & Fine"
      />
    </div>
  );
}
