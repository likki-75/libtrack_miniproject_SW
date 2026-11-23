import React, { useState } from 'react';
import { Save, Database, Trash2, Info } from 'lucide-react';
import { settingsApi } from '../lib/api';
import { useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { LibrarySettings } from '../types';

interface SettingsViewProps {
  settings: LibrarySettings;
  onSettingsUpdated: (next: LibrarySettings) => void;
}

export function SettingsView({ settings, onSettingsUpdated }: SettingsViewProps) {
  const { showToast } = useToast();
  const [libraryName, setLibraryName] = useState(settings.libraryName);
  const [borrowingDurationDays, setBorrowingDurationDays] = useState(String(settings.borrowingDurationDays));
  const [maxBorrowingLimit, setMaxBorrowingLimit] = useState(String(settings.maxBorrowingLimit));
  const [finePerOverdueDay, setFinePerOverdueDay] = useState(String(settings.finePerOverdueDay));
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [preventDuplicateActiveIssue, setPreventDuplicateActiveIssue] = useState(
    settings.preventDuplicateActiveIssue
  );

  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsApi.update({
        libraryName: libraryName.trim(),
        borrowingDurationDays: Number(borrowingDurationDays),
        maxBorrowingLimit: Number(maxBorrowingLimit),
        finePerOverdueDay: Number(finePerOverdueDay),
        currencySymbol: currencySymbol.trim() || '₹',
        preventDuplicateActiveIssue,
      });
      onSettingsUpdated(res.settings);
      showToast('success', 'Settings saved', 'Library circulation and fine rules have been updated.');
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await settingsApi.seedDemo();
      showToast(
        'success',
        'Sample data seeded',
        `Added ${res.inserted.books} books, ${res.inserted.students} students, ${res.inserted.borrowRecords} borrow records, ${res.inserted.testCases} test cases, and ${res.inserted.defects} defects.`
      );
    } catch (err) {
      showToast('error', 'Seed failed', err instanceof Error ? err.message : 'Unable to seed sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await settingsApi.resetData();
      showToast('success', 'Database cleared', 'All books, students, borrow records, and lab records were cleared.');
      setResetOpen(false);
    } catch (err) {
      showToast('error', 'Reset failed', err instanceof Error ? err.message : 'Unable to reset data.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Circulation &amp; Fine Policy Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Changes immediately govern book issuing limits, default due dates, and overdue fine calculations.
          </p>
        </div>

        <div>
          <label htmlFor="set-lib-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Library Name
          </label>
          <input
            id="set-lib-name"
            type="text"
            required
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="set-duration" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Loan Duration (Days)
            </label>
            <input
              id="set-duration"
              type="number"
              required
              min={1}
              max={365}
              value={borrowingDurationDays}
              onChange={(e) => setBorrowingDurationDays(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="set-limit" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Max Books / Student
            </label>
            <input
              id="set-limit"
              type="number"
              required
              min={1}
              max={50}
              value={maxBorrowingLimit}
              onChange={(e) => setMaxBorrowingLimit(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="set-fine" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Fine / Overdue Day
            </label>
            <input
              id="set-fine"
              type="number"
              required
              min={0}
              step="0.5"
              value={finePerOverdueDay}
              onChange={(e) => setFinePerOverdueDay(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="set-currency" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Currency Symbol
            </label>
            <input
              id="set-currency"
              type="text"
              required
              maxLength={4}
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={preventDuplicateActiveIssue}
            onChange={(e) => setPreventDuplicateActiveIssue(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>Prevent duplicate active issue of the same book to the same student</span>
        </label>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Policy Settings'}
          </button>
        </div>
      </form>

      {/* Optional Sample Data Seeder */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Optional Sample Data &amp; Database Tools
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Populate sample textbooks, students, borrowing transactions, and Software Testing Lab records for faculty demonstration, or reset operational records to start clean.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60"
          >
            <Database className="h-4 w-4" />
            {seeding ? 'Seeding Sample Data...' : 'Seed Sample Library & Lab Data'}
          </button>

          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Reset Non-Admin Data
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            Running on persistent server-side SQLite (<span className="font-mono">data/libtrack.sqlite</span>) with atomic transactions and salted scrypt authentication. To wire your own Firebase project manually later, follow <span className="font-mono">testing-lab/FIREBASE_MANUAL_SETUP_GUIDE.md</span>.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        loading={resetting}
        title="Reset All Library & Testing Lab Records"
        message="This permanently removes all books, students, borrowing records, test cases, defects, and activity logs while keeping your administrator account and policy settings intact."
        confirmLabel="Reset Data"
      />
    </div>
  );
}
