import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  BookCheck,
  Users,
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { dashboardApi, settingsApi } from '../lib/api';
import { useToast } from './ui/Toast';
import type { DashboardStats, User } from '../types';
import type { NavSection } from './Layout';

interface DashboardViewProps {
  user: User;
  currencySymbol: string;
  onNavigate: (section: NavSection) => void;
}

export function DashboardView({ user, currencySymbol, onNavigate }: DashboardViewProps) {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await settingsApi.seedDemo();
      showToast(
        'success',
        'Sample data seeded',
        `Added ${res.inserted.books} books, ${res.inserted.students} students, ${res.inserted.borrowRecords} borrow records, and ${res.inserted.testCases} test cases.`
      );
      await loadStats();
    } catch (err) {
      showToast('error', 'Seed failed', err instanceof Error ? err.message : 'Unable to seed sample data.');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="mt-4 h-7 w-14 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl border border-slate-200 bg-white" />
          <div className="h-72 rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{error || 'Unable to load dashboard.'}</p>
        <button
          type="button"
          onClick={loadStats}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const maxMonthlyVal = Math.max(
    1,
    ...stats.monthlyActivity.map((m) => Math.max(m.issued, m.returned))
  );
  const totalCategoryBooks = Math.max(
    1,
    stats.categoryDistribution.reduce((acc, c) => acc + c.copies, 0)
  );

  const kpiCards =
    user.role === 'admin'
      ? [
          { label: 'Total Books', value: stats.totalBooks, sub: `${stats.totalCopies} total copies` },
          { label: 'Available Copies', value: stats.totalAvailableCopies, sub: 'Ready for issue' },
          { label: 'Currently Borrowed', value: stats.currentlyBorrowed, sub: 'Active loans' },
          {
            label: 'Overdue Books',
            value: stats.overdueBooks,
            sub: stats.overdueBooks > 0 ? 'Action needed' : 'All on schedule',
            alert: stats.overdueBooks > 0,
          },
          { label: 'Total Students', value: stats.totalStudents, sub: 'Registered members' },
          {
            label: 'Borrow Records',
            value: stats.totalBorrowRecords,
            sub: `${currencySymbol}${stats.totalFinesCollected.toFixed(2)} fines logged`,
          },
        ]
      : [
          { label: 'Catalog Titles', value: stats.totalBooks, sub: `${stats.totalCopies} total copies` },
          { label: 'Available Copies', value: stats.totalAvailableCopies, sub: 'Ready to borrow' },
          { label: 'My Active Loans', value: stats.currentlyBorrowed, sub: 'Currently issued to you' },
          {
            label: 'My Overdue Books',
            value: stats.overdueBooks,
            sub: stats.overdueBooks > 0 ? 'Return promptly' : 'No overdue items',
            alert: stats.overdueBooks > 0,
          },
          { label: 'My Total Borrows', value: stats.totalBorrowRecords, sub: 'All-time records' },
          {
            label: 'My Total Fines',
            value: `${currencySymbol}${stats.totalFinesCollected.toFixed(2)}`,
            sub: 'Historical accrued',
          },
        ];

  return (
    <div className="space-y-6">
      {/* Optional Empty-Catalog Onboarding Banner for Admin */}
      {user.role === 'admin' && stats.totalBooks === 0 && stats.totalStudents === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Your library database is empty
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Add books and students manually, or load optional sample library &amp; Software Testing Lab records for quick demonstration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('books')}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Add First Book
            </button>
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              <Database className="h-3.5 w-3.5" />
              {seeding ? 'Seeding Sample Data...' : 'Seed Sample Library & Lab Data'}
            </button>
          </div>
        </div>
      )}

      {/* 6-Card KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between"
          >
            <span className="text-xs font-medium text-slate-500">{card.label}</span>
            <p
              className={`mt-2 font-display text-2xl font-bold tabular-nums ${
                card.alert ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {card.value}
            </p>
            <span className={`mt-1 text-xs ${card.alert ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
              {card.sub}
            </span>
          </div>
        ))}
      </section>

      {/* Visual Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Borrowing Activity Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Borrowing &amp; Return Volume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Monthly circulation trends from database records</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                Issued
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                Returned
              </span>
            </div>
          </div>

          {stats.monthlyActivity.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center text-sm text-slate-500">
              <BookOpen className="h-8 w-8 text-slate-300 mb-2" />
              <p>No borrowing activity recorded yet.</p>
            </div>
          ) : (
            <div className="h-56 flex items-end gap-4 pt-6 pb-2 border-b border-slate-200">
              {stats.monthlyActivity.map((item) => {
                const issuedHeight = Math.max(8, Math.round((item.issued / maxMonthlyVal) * 150));
                const returnedHeight = Math.max(
                  item.returned > 0 ? 8 : 0,
                  Math.round((item.returned / maxMonthlyVal) * 150)
                );
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <div className="flex items-end gap-1.5 h-[160px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-mono tabular-nums text-slate-600">
                          {item.issued}
                        </span>
                        <div
                          style={{ height: `${issuedHeight}px` }}
                          className="w-5 sm:w-7 rounded-t-md bg-blue-600 transition-all"
                          title={`Issued: ${item.issued}`}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-mono tabular-nums text-slate-600">
                          {item.returned}
                        </span>
                        <div
                          style={{ height: `${returnedHeight}px` }}
                          className="w-5 sm:w-7 rounded-t-md bg-emerald-600 transition-all"
                          title={`Returned: ${item.returned}`}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-500 truncate">{item.month}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col">
          <h2 className="font-display text-base font-semibold text-slate-900">Inventory by Category</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">Available vs. total copies per subject</p>

          {stats.categoryDistribution.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              No books cataloged yet.
            </div>
          ) : (
            <div className="space-y-3.5 overflow-y-auto max-h-60 pr-1">
              {stats.categoryDistribution.map((cat) => {
                const pct = Math.round((cat.copies / totalCategoryBooks) * 100);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-800 truncate pr-2">{cat.category}</span>
                      <span className="font-mono tabular-nums text-slate-500 shrink-0">
                        {cat.available}/{cat.copies} avail ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Popular Books + Nearing Due / Overdue + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular Books */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Popular Books</h2>
            <button
              type="button"
              onClick={() => onNavigate('books')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              Catalog
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {stats.popularBooks.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No catalog data yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.popularBooks.map((book) => (
                <div key={book.bookId} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {book.author} · <span className="font-mono">{book.bookId}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold font-mono tabular-nums text-slate-900">
                      {book.borrowCount} loans
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500">
                      {book.availableCopies}/{book.totalCopies} left
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Books Nearing Due Dates / Overdue */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Due Soon &amp; Overdue</h2>
            <button
              type="button"
              onClick={() => onNavigate(user.role === 'admin' ? 'return' : 'history')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              {user.role === 'admin' ? 'Process Returns' : 'View History'}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {stats.nearingDue.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <BookCheck className="h-7 w-7 text-emerald-500 mx-auto mb-2" />
              <p>No overdue or due-soon books.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.nearingDue.map((rec) => {
                const isOverdue = rec.status === 'Overdue';
                return (
                  <div key={rec.recordId} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{rec.bookTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {rec.studentName} · <span className="font-mono">{rec.recordId}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isOverdue ? 'text-red-600' : 'text-amber-700'
                        }`}
                      >
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        {rec.status}
                      </span>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                        Due {rec.dueDate}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">Recent Activity</h2>
            <span className="text-xs text-slate-400">Latest audit log</span>
          </div>

          {stats.recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <Users className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p>No activity events recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentActivity.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-slate-800 leading-snug">{log.details}</p>
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    {log.action} · {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
