import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookPlus, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { booksApi, borrowApi, studentsApi } from '../lib/api';
import { useToast } from './ui/Toast';
import type { Book, LibrarySettings, Student } from '../types';

interface IssueBookViewProps {
  settings: LibrarySettings;
}

function addDaysLocal(isoDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isInteger(days) || days < 0) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getTodayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function IssueBookView({ settings }: IssueBookViewProps) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentQuery, setStudentQuery] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayLocal());
  const [durationDays, setDurationDays] = useState(String(settings.borrowingDurationDays));
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([studentsApi.list(), booksApi.list()]);
      setStudents(sRes.students);
      setBooks(bRes.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load students and books.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setDurationDays(String(settings.borrowingDurationDays));
  }, [settings.borrowingDurationDays]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentId.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.bookId.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q)
    );
  }, [books, bookQuery]);

  const selectedStudent = students.find((s) => s.studentId === selectedStudentId) ?? null;
  const selectedBook = books.find((b) => b.bookId === selectedBookId) ?? null;
  const computedDueDate = addDaysLocal(issueDate, Number(durationDays));

  const studentLimitReached =
    selectedStudent !== null && (selectedStudent.activeBorrowCount ?? 0) >= settings.maxBorrowingLimit;
  const bookUnavailable = selectedBook !== null && selectedBook.availableCopies <= 0;

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedStudentId) {
      setError('Please select a valid student.');
      return;
    }
    if (!selectedBookId) {
      setError('Please select a book to issue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await borrowApi.issue({
        studentId: selectedStudentId,
        bookId: selectedBookId,
        issueDate,
        borrowingDurationDays: Number(durationDays),
        notes: notes.trim(),
      });
      showToast(
        'success',
        'Book issued successfully',
        `Record ${res.record.recordId} created. Due on ${res.record.dueDate}.`
      );
      setSelectedBookId('');
      setNotes('');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to issue book.';
      setError(msg);
      showToast('error', 'Issue failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <div className="lg:col-span-2 h-96 rounded-xl border border-slate-200 bg-white" />
        <div className="h-96 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <form onSubmit={handleIssue} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Selection Form */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Issue Book Transaction</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atomically assigns a copy, checks borrowing limits, and updates inventory availability.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="issue-error"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Student Selector */}
        <div className="space-y-2">
          <label htmlFor="issue-student-select" className="block text-xs font-semibold text-slate-700">
            1. Select Student
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Filter students by ID, name, or email..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm mb-2"
            />
          </div>
          <select
            id="issue-student-select"
            data-testid="issue-student-select"
            required
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="">-- Choose a registered student --</option>
            {filteredStudents.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.studentId} — {s.fullName} ({s.activeBorrowCount ?? 0}/{settings.maxBorrowingLimit} active)
              </option>
            ))}
          </select>
        </div>

        {/* Book Selector */}
        <div className="space-y-2">
          <label htmlFor="issue-book-select" className="block text-xs font-semibold text-slate-700">
            2. Search &amp; Select Book
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={bookQuery}
              onChange={(e) => setBookQuery(e.target.value)}
              placeholder="Filter books by title, author, ISBN, or Book ID..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm mb-2"
            />
          </div>
          <select
            id="issue-book-select"
            data-testid="issue-book-select"
            required
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="">-- Choose a catalog book --</option>
            {filteredBooks.map((b) => (
              <option key={b.bookId} value={b.bookId}>
                {b.bookId} — {b.title} ({b.availableCopies}/{b.totalCopies} available)
              </option>
            ))}
          </select>
        </div>

        {/* Dates & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="issue-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
              3. Issue Date
            </label>
            <input
              id="issue-date"
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="issue-duration" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Borrowing Duration (Days)
            </label>
            <input
              id="issue-duration"
              type="number"
              required
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label htmlFor="issue-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Notes (Optional)
          </label>
          <input
            id="issue-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Course reference, lab assignment..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Right Summary & Policy Validation Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h3 className="font-display text-base font-semibold text-slate-900">Loan Verification Summary</h3>

        <div className="space-y-3 text-xs border-y border-slate-200 py-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Selected Student</span>
            <span className="font-medium text-slate-900">
              {selectedStudent ? selectedStudent.fullName : 'Not selected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Student Active Loans</span>
            <span
              className={`font-mono font-semibold ${
                studentLimitReached ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {selectedStudent ? `${selectedStudent.activeBorrowCount ?? 0} / ${settings.maxBorrowingLimit}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Book Availability</span>
            <span
              className={`font-mono font-semibold ${
                bookUnavailable ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {selectedBook ? `${selectedBook.availableCopies} / ${selectedBook.totalCopies} copies` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Issue Date</span>
            <span className="font-mono text-slate-900">{issueDate || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Calculated Due Date</span>
            <span className="font-mono font-semibold text-blue-700">{computedDueDate || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Overdue Fine Policy</span>
            <span className="font-mono text-slate-700">
              {settings.currencySymbol}
              {settings.finePerOverdueDay}/day
            </span>
          </div>
        </div>

        {(studentLimitReached || bookUnavailable) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
            {studentLimitReached && (
              <p className="font-medium">
                Borrowing limit reached ({settings.maxBorrowingLimit} max active books).
              </p>
            )}
            {bookUnavailable && <p className="font-medium">Selected book has 0 available copies.</p>}
          </div>
        )}

        {selectedStudent && selectedBook && !studentLimitReached && !bookUnavailable && (
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Eligible for atomic issue transaction.</span>
          </div>
        )}

        <button
          type="submit"
          data-testid="issue-submit-btn"
          disabled={submitting || !selectedStudent || !selectedBook || studentLimitReached || bookUnavailable}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <BookPlus className="h-4 w-4" />
          {submitting ? 'Issuing Book...' : 'Confirm & Issue Book'}
        </button>
      </div>
    </form>
  );
}
