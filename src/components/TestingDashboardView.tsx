import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Printer,
  Search,
  AlertCircle,
  Info,
  ClipboardList,
  Bug,
  FileText,
  BarChart3,
} from 'lucide-react';
import { testingApi } from '../lib/api';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type {
  Defect,
  DefectPriority,
  DefectSeverity,
  DefectStatus,
  TestCase,
  TestCaseStatus,
  User,
} from '../types';

interface TestingDashboardViewProps {
  user: User;
}

type TestingTab = 'summary' | 'test-cases' | 'defects' | 'plan-labs';

const TEST_STATUSES: TestCaseStatus[] = ['Pass', 'Fail', 'Blocked', 'Not Executed'];
const DEFECT_SEVERITIES: DefectSeverity[] = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];
const DEFECT_PRIORITIES: DefectPriority[] = ['P1 - Urgent', 'P2 - High', 'P3 - Medium', 'P4 - Low'];
const DEFECT_STATUSES: DefectStatus[] = ['New', 'Open', 'In Progress', 'Fixed', 'Retested', 'Closed'];

const DEFAULT_TC = {
  testCaseId: '',
  module: 'Issue Books',
  technique: 'BVA',
  testScenario: '',
  testInput: '',
  expectedResult: '',
  actualResult: '',
  status: 'Not Executed' as TestCaseStatus,
  defectId: '',
};

const DEFAULT_DEFECT = {
  defectId: '',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedResult: '',
  actualResult: '',
  severity: 'Major' as DefectSeverity,
  priority: 'P2 - High' as DefectPriority,
  status: 'New' as DefectStatus,
  relatedTestCase: '',
  dateReported: new Date().toISOString().slice(0, 10),
};

export function TestingDashboardView({ user }: TestingDashboardViewProps) {
  const { showToast } = useToast();
  const isAdmin = user.role === 'admin';

  const [activeTab, setActiveTab] = useState<TestingTab>('summary');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);

  // Test case filters & modals
  const [tcSearch, setTcSearch] = useState('');
  const [tcStatusFilter, setTcStatusFilter] = useState('All');
  const [tcModalOpen, setTcModalOpen] = useState(false);
  const [editingTc, setEditingTc] = useState<TestCase | null>(null);
  const [tcForm, setTcForm] = useState(DEFAULT_TC);
  const [tcSaving, setTcSaving] = useState(false);
  const [deleteTcTarget, setDeleteTcTarget] = useState<TestCase | null>(null);

  // Defect filters & modals
  const [defectSearch, setDefectSearch] = useState('');
  const [defectStatusFilter, setDefectStatusFilter] = useState('All');
  const [defectModalOpen, setDefectModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [defectForm, setDefectForm] = useState(DEFAULT_DEFECT);
  const [defectSaving, setDefectSaving] = useState(false);
  const [deleteDefectTarget, setDeleteDefectTarget] = useState<Defect | null>(null);

  const [selectedLabSheet, setSelectedLabSheet] = useState<string>('lab1');

  const loadTestingData = useCallback(async () => {
    setLoading(true);
    try {
      const [tcRes, defRes] = await Promise.all([testingApi.listTestCases(), testingApi.listDefects()]);
      setTestCases(tcRes.testCases);
      setDefects(defRes.defects);
    } catch (err) {
      showToast('error', 'Failed to load testing data', err instanceof Error ? err.message : 'Server error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTestingData();
  }, [loadTestingData]);

  // Live Calculated Summary Statistics
  const summary = useMemo(() => {
    const total = testCases.length;
    const passed = testCases.filter((t) => t.status === 'Pass').length;
    const failed = testCases.filter((t) => t.status === 'Fail').length;
    const blocked = testCases.filter((t) => t.status === 'Blocked').length;
    const notExecuted = testCases.filter((t) => t.status === 'Not Executed').length;
    const executed = total - notExecuted;

    const passPct = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
    const failPct = total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0;
    const completionPct = total > 0 ? Number(((executed / total) * 100).toFixed(1)) : 0;

    const defectsBySeverity = DEFECT_SEVERITIES.map((sev) => ({
      severity: sev,
      count: defects.filter((d) => d.severity === sev).length,
    }));

    const defectsByStatus = DEFECT_STATUSES.map((st) => ({
      status: st,
      count: defects.filter((d) => d.status === st).length,
    }));

    return {
      total,
      passed,
      failed,
      blocked,
      notExecuted,
      executed,
      passPct,
      failPct,
      completionPct,
      defectsBySeverity,
      defectsByStatus,
    };
  }, [testCases, defects]);

  const filteredTestCases = useMemo(() => {
    const q = tcSearch.trim().toLowerCase();
    return testCases.filter((tc) => {
      if (tcStatusFilter !== 'All' && tc.status !== tcStatusFilter) return false;
      if (!q) return true;
      return (
        tc.testCaseId.toLowerCase().includes(q) ||
        tc.module.toLowerCase().includes(q) ||
        tc.technique.toLowerCase().includes(q) ||
        tc.testScenario.toLowerCase().includes(q) ||
        (tc.defectId ?? '').toLowerCase().includes(q)
      );
    });
  }, [testCases, tcSearch, tcStatusFilter]);

  const filteredDefects = useMemo(() => {
    const q = defectSearch.trim().toLowerCase();
    return defects.filter((d) => {
      if (defectStatusFilter !== 'All' && d.status !== defectStatusFilter) return false;
      if (!q) return true;
      return (
        d.defectId.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.relatedTestCase.toLowerCase().includes(q) ||
        d.severity.toLowerCase().includes(q)
      );
    });
  }, [defects, defectSearch, defectStatusFilter]);

  // Test Case handlers
  const openAddTc = () => {
    setEditingTc(null);
    const nextNum = String(testCases.length + 1).padStart(3, '0');
    setTcForm({ ...DEFAULT_TC, testCaseId: `TC-${nextNum}` });
    setTcModalOpen(true);
  };

  const openEditTc = (tc: TestCase) => {
    setEditingTc(tc);
    setTcForm({
      testCaseId: tc.testCaseId,
      module: tc.module,
      technique: tc.technique,
      testScenario: tc.testScenario,
      testInput: tc.testInput,
      expectedResult: tc.expectedResult,
      actualResult: tc.actualResult,
      status: tc.status,
      defectId: tc.defectId ?? '',
    });
    setTcModalOpen(true);
  };

  const saveTc = async (e: React.FormEvent) => {
    e.preventDefault();
    setTcSaving(true);
    try {
      const payload = {
        ...tcForm,
        testCaseId: tcForm.testCaseId.trim().toUpperCase(),
        defectId: tcForm.defectId.trim() ? tcForm.defectId.trim().toUpperCase() : null,
      };
      if (editingTc) {
        await testingApi.updateTestCase(editingTc.testCaseId, payload);
        showToast('success', 'Test case updated', `${payload.testCaseId} marked as ${payload.status}.`);
      } else {
        await testingApi.createTestCase(payload);
        showToast('success', 'Test case created', `${payload.testCaseId} added.`);
      }
      setTcModalOpen(false);
      await loadTestingData();
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : 'Unable to save test case.');
    } finally {
      setTcSaving(false);
    }
  };

  const deleteTc = async () => {
    if (!deleteTcTarget) return;
    try {
      await testingApi.deleteTestCase(deleteTcTarget.testCaseId);
      showToast('success', 'Test case deleted', deleteTcTarget.testCaseId);
      setDeleteTcTarget(null);
      await loadTestingData();
    } catch (err) {
      showToast('error', 'Delete failed', err instanceof Error ? err.message : 'Unable to delete.');
    }
  };

  // Defect handlers
  const openAddDefect = () => {
    setEditingDefect(null);
    const nextNum = String(defects.length + 1).padStart(3, '0');
    setDefectForm({
      ...DEFAULT_DEFECT,
      defectId: `BUG-${nextNum}`,
      dateReported: new Date().toISOString().slice(0, 10),
    });
    setDefectModalOpen(true);
  };

  const openEditDefect = (d: Defect) => {
    setEditingDefect(d);
    setDefectForm({
      defectId: d.defectId,
      title: d.title,
      description: d.description,
      stepsToReproduce: d.stepsToReproduce,
      expectedResult: d.expectedResult,
      actualResult: d.actualResult,
      severity: d.severity,
      priority: d.priority,
      status: d.status,
      relatedTestCase: d.relatedTestCase,
      dateReported: d.dateReported,
    });
    setDefectModalOpen(true);
  };

  const saveDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    setDefectSaving(true);
    try {
      const payload = {
        ...defectForm,
        defectId: defectForm.defectId.trim().toUpperCase(),
        relatedTestCase: defectForm.relatedTestCase.trim().toUpperCase(),
      };
      if (editingDefect) {
        await testingApi.updateDefect(editingDefect.defectId, payload);
        showToast('success', 'Defect updated', `${payload.defectId} is now ${payload.status}.`);
      } else {
        await testingApi.createDefect(payload);
        showToast('success', 'Defect logged', `${payload.defectId} recorded.`);
      }
      setDefectModalOpen(false);
      await loadTestingData();
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : 'Unable to save defect.');
    } finally {
      setDefectSaving(false);
    }
  };

  const deleteDefect = async () => {
    if (!deleteDefectTarget) return;
    try {
      await testingApi.deleteDefect(deleteDefectTarget.defectId);
      showToast('success', 'Defect deleted', deleteDefectTarget.defectId);
      setDeleteDefectTarget(null);
      await loadTestingData();
    } catch (err) {
      showToast('error', 'Delete failed', err instanceof Error ? err.message : 'Unable to delete.');
    }
  };

  const tcStatusClass = (status: TestCaseStatus) => {
    switch (status) {
      case 'Pass':
        return 'text-emerald-700 font-semibold';
      case 'Fail':
        return 'text-red-600 font-semibold';
      case 'Blocked':
        return 'text-amber-700 font-semibold';
      default:
        return 'text-slate-500 font-medium';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Software Testing Lab Mini Project · Topic 7
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Execution records, internal defect workflow, test plan, test report, and Lab Sheets 1–14 reference.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { id: 'summary', label: 'Summary & Report', icon: BarChart3 },
            { id: 'test-cases', label: 'Test Cases', icon: ClipboardList },
            { id: 'defects', label: 'Defect Tracker', icon: Bug },
            { id: 'plan-labs', label: 'Test Plan & Labs 1–14', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TestingTab)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        <>
          {/* TAB 1: EXECUTION SUMMARY & TEST REPORT */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between no-print">
                <p className="text-xs text-slate-500">
                  All metrics below are computed dynamically from recorded Test Cases ({summary.total}) and Defects ({defects.length}).
                </p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Test Report
                </button>
              </div>

              {/* Execution Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {[
                  { label: 'Total Cases', value: summary.total, tone: 'text-slate-900' },
                  { label: 'Passed', value: summary.passed, tone: 'text-emerald-700' },
                  { label: 'Failed', value: summary.failed, tone: 'text-red-600' },
                  { label: 'Blocked', value: summary.blocked, tone: 'text-amber-700' },
                  { label: 'Not Executed', value: summary.notExecuted, tone: 'text-slate-600' },
                  { label: 'Pass Rate', value: `${summary.passPct}%`, tone: 'text-emerald-700' },
                  { label: 'Completion', value: `${summary.completionPct}%`, tone: 'text-blue-700' },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${m.tone}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Report Breakdown Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Test Execution Status Distribution */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Test Execution Summary (Lab Sheet 12 &amp; 14)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Failure percentage: <span className="font-mono font-semibold text-red-600">{summary.failPct}%</span> · Pass percentage: <span className="font-mono font-semibold text-emerald-700">{summary.passPct}%</span>
                    </p>
                  </div>

                  {summary.total === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      No test cases recorded yet. Add test cases or seed sample data in Settings.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: 'Passed', count: summary.passed, color: 'bg-emerald-600' },
                        { label: 'Failed', count: summary.failed, color: 'bg-red-600' },
                        { label: 'Blocked', count: summary.blocked, color: 'bg-amber-500' },
                        { label: 'Not Executed', count: summary.notExecuted, color: 'bg-slate-400' },
                      ].map((row) => {
                        const pct = Math.round((row.count / summary.total) * 100);
                        return (
                          <div key={row.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-slate-700">{row.label}</span>
                              <span className="font-mono tabular-nums text-slate-600">
                                {row.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Defects by Severity & Status */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Defect Report Breakdown
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 mb-2.5">By Severity</h4>
                      <div className="divide-y divide-slate-100 text-xs">
                        {summary.defectsBySeverity.map((s) => (
                          <div key={s.severity} className="py-1.5 flex justify-between">
                            <span className="text-slate-700">{s.severity}</span>
                            <span className="font-mono font-semibold tabular-nums text-slate-900">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 mb-2.5">By Lifecycle Status</h4>
                      <div className="divide-y divide-slate-100 text-xs">
                        {summary.defectsByStatus.map((s) => (
                          <div key={s.status} className="py-1.5 flex justify-between">
                            <span className="text-slate-700">{s.status}</span>
                            <span className="font-mono font-semibold tabular-nums text-slate-900">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEST CASE MANAGEMENT */}
          {activeTab === 'test-cases' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-1 flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={tcSearch}
                      onChange={(e) => setTcSearch(e.target.value)}
                      placeholder="Search Test ID, module, technique, scenario..."
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={tcStatusFilter}
                    onChange={(e) => setTcStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="All">All Statuses</option>
                    {TEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openAddTc}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    Add Test Case
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {filteredTestCases.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No test cases found matching your filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Test Case ID</th>
                          <th className="py-3 px-4">Scenario &amp; Module</th>
                          <th className="py-3 px-4">Test Input</th>
                          <th className="py-3 px-4">Expected Result</th>
                          <th className="py-3 px-4">Actual Result</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Defect ID</th>
                          {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredTestCases.map((tc) => (
                          <tr key={tc.testCaseId} className="hover:bg-slate-50/70 align-top">
                            <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {tc.testCaseId}
                            </td>
                            <td className="py-3 px-4 min-w-[210px]">
                              <p className="font-medium text-slate-900">{tc.testScenario}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {tc.module} · {tc.technique}
                              </p>
                            </td>
                            <td className="py-3 px-4 max-w-[180px] text-slate-600">{tc.testInput}</td>
                            <td className="py-3 px-4 max-w-[200px] text-slate-700">{tc.expectedResult}</td>
                            <td className="py-3 px-4 max-w-[200px] text-slate-600">
                              {tc.actualResult || '—'}
                            </td>
                            <td className={`py-3 px-4 whitespace-nowrap ${tcStatusClass(tc.status)}`}>
                              {tc.status}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {tc.defectId || '—'}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openEditTc(tc)}
                                  aria-label={`Record execution for ${tc.testCaseId}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTcTarget(tc)}
                                  aria-label={`Delete ${tc.testCaseId}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INTERNAL DEFECT TRACKING (BUGZILLA/MANTISBT-STYLE WORKFLOW) */}
          {activeTab === 'defects' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Internal Defect Tracking Module:</strong> Models a Bugzilla / MantisBT-style defect lifecycle (New → Open → In Progress → Fixed → Retested → Closed) stored in LibTrack&apos;s database. It is an internal project tracker, not an external Bugzilla or MantisBT API integration.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-1 flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={defectSearch}
                      onChange={(e) => setDefectSearch(e.target.value)}
                      placeholder="Search Defect ID, title, severity, or test case..."
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={defectStatusFilter}
                    onChange={(e) => setDefectStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="All">All Defect Statuses</option>
                    {DEFECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openAddDefect}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    Report Defect
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {filteredDefects.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">No defects logged matching filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Defect ID</th>
                          <th className="py-3 px-4">Summary &amp; Steps</th>
                          <th className="py-3 px-4">Severity / Priority</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Test Case</th>
                          <th className="py-3 px-4">Reported</th>
                          {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredDefects.map((d) => (
                          <tr key={d.defectId} className="hover:bg-slate-50/70 align-top">
                            <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {d.defectId}
                            </td>
                            <td className="py-3 px-4 min-w-[260px] max-w-md">
                              <p className="font-semibold text-slate-900">{d.title}</p>
                              <p className="text-slate-600 mt-1">{d.description}</p>
                              <p className="text-[11px] text-slate-500 mt-1 whitespace-pre-line">
                                <span className="font-medium text-slate-700">Expected:</span> {d.expectedResult} ·{' '}
                                <span className="font-medium text-slate-700">Actual:</span> {d.actualResult}
                              </p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <p
                                className={`font-semibold ${
                                  d.severity === 'Blocker' || d.severity === 'Critical'
                                    ? 'text-red-600'
                                    : d.severity === 'Major'
                                      ? 'text-amber-700'
                                      : 'text-slate-700'
                                }`}
                              >
                                {d.severity}
                              </p>
                              <p className="text-[11px] text-slate-500">{d.priority}</p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-semibold text-blue-700">{d.status}</td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {d.relatedTestCase || '—'}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {d.dateReported}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openEditDefect(d)}
                                  aria-label={`Edit ${d.defectId}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteDefectTarget(d)}
                                  aria-label={`Delete ${d.defectId}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TEST PLAN & INTERACTIVE LAB SHEETS 1-14 */}
          {activeTab === 'plan-labs' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left Lab Sheet Selector */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                {[
                  { id: 'plan', label: 'Master Test Plan (Lab 14)' },
                  { id: 'lab1', label: 'Lab 1: SDLC vs STLC' },
                  { id: 'lab2', label: 'Lab 2: Manual Scenarios' },
                  { id: 'lab3', label: 'Lab 3: BVA & ECP Tables' },
                  { id: 'lab4', label: 'Lab 4: Decision & State' },
                  { id: 'lab5', label: 'Lab 5: CFG & Complexity' },
                  { id: 'lab6-13', label: 'Labs 6–13: Tools & Suites' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLabSheet(item.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      selectedLabSheet === item.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Right Content Panel */}
              <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 space-y-5 text-sm">
                {selectedLabSheet === 'plan' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Master Test Plan — LibTrack Library Management System
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Testing Objectives</h4>
                        <p className="text-slate-600 leading-relaxed">
                          Verify functional correctness, role-based access enforcement, atomic book circulation consistency, accurate overdue fine calculation, and UI reliability across desktop/mobile viewports.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Scope &amp; Approach</h4>
                        <p className="text-slate-600 leading-relaxed">
                          In scope: Auth &amp; RBAC, Book CRUD, Student CRUD, Atomic Issue/Return, Fine Calculator, History pagination, Testing Dashboard. Combines Manual Black-Box (BVA/ECP/Decision/State), White-Box CFG, JUnit 4 Java core logic tests, Selenium WebDriver, and JMeter load testing.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Entry Criteria</h4>
                        <ul className="list-disc pl-4 text-slate-600 space-y-1">
                          <li>Application compiles cleanly (`npm run lint` &amp; `npm run build`).</li>
                          <li>Initial Admin account configured and database schema initialized.</li>
                          <li>Test environment accessible on `http://localhost:3000`.</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Exit Criteria</h4>
                        <ul className="list-disc pl-4 text-slate-600 space-y-1">
                          <li>All critical/blocker defects resolved and retested.</li>
                          <li>100% of planned high-priority test cases executed.</li>
                          <li>Test Summary Report compiled from recorded execution metrics.</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Risks &amp; Mitigation</h4>
                        <p className="text-slate-600 leading-relaxed">
                          Risk: Concurrent issue requests causing negative inventory. Mitigation: SQLite `BEGIN IMMEDIATE` atomic decrement with `availableCopies &gt; 0` guard. Risk: WebDriver browser mismatch. Mitigation: WebDriverManager version pinning.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900 mb-1.5">Deliverables</h4>
                        <p className="text-slate-600 leading-relaxed">
                          Test Plan, Test Case Suite, Defect Log, JUnit 4 Maven Module (`testing-lab/junit-module`), Selenium WebDriver Suite (`testing-lab/selenium-webdriver`), JMeter `.jmx` Test Plan (`testing-lab/jmeter`), and Lab Sheets 1–14 Report.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedLabSheet === 'lab1' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lab Sheet 1: Introduction to Software Testing, SDLC vs STLC
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Phase</th>
                            <th className="py-2.5 px-3">SDLC Activity (LibTrack Build)</th>
                            <th className="py-2.5 px-3">STLC Activity (Quality Assurance)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">1. Requirements</td>
                            <td className="py-2.5 px-3">Define RBAC, inventory, issue/return, fine rules</td>
                            <td className="py-2.5 px-3">Requirement analysis, identify testable invariants &amp; RTM</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">2. Planning &amp; Design</td>
                            <td className="py-2.5 px-3">Schema design, API endpoints, React UI layout</td>
                            <td className="py-2.5 px-3">Master Test Plan, select BVA/ECP/Decision/CFG techniques</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">3. Development</td>
                            <td className="py-2.5 px-3">Implement Express API, SQLite transactions, React views</td>
                            <td className="py-2.5 px-3">Author JUnit 4 tests, Selenium WebDriver scripts, JMeter plan</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">4. Verification</td>
                            <td className="py-2.5 px-3">Fix defects reported in Defect Tracker</td>
                            <td className="py-2.5 px-3">Execute test cases, log actual results, track defect lifecycle</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">5. Closure</td>
                            <td className="py-2.5 px-3">Production build &amp; deployment readiness</td>
                            <td className="py-2.5 px-3">Evaluate exit criteria &amp; publish Test Summary Report</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedLabSheet === 'lab2' && (
                  <div className="space-y-3">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lab Sheet 2: Manual Functional &amp; Non-Functional Testing
                    </h3>
                    <p className="text-xs text-slate-600">
                      Covers end-to-end manual scenarios across Login/Auth, Book CRUD &amp; search, Student management, Issue/Return transactions, Fine calculator accuracy, and Non-Functional checks (WCAG contrast, responsive layout, RBAC HTTP 403 enforcement, response latency). Full scenario table is seeded/managed inside the <strong>Test Cases</strong> tab.
                    </p>
                  </div>
                )}

                {selectedLabSheet === 'lab3' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lab Sheet 3: Boundary Value Analysis (BVA) &amp; Equivalence Class Partitioning (ECP)
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Parameter</th>
                            <th className="py-2.5 px-3">Valid Equivalence Class</th>
                            <th className="py-2.5 px-3">Invalid Equivalence Classes</th>
                            <th className="py-2.5 px-3">BVA Test Values (Min-, Min, Nom, Max, Max+)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-semibold">Borrow Limit (Max = 3)</td>
                            <td className="py-2.5 px-3">[0, 1, 2] active loans</td>
                            <td className="py-2.5 px-3">&lt; 0, &ge; 3 active loans</td>
                            <td className="py-2.5 px-3">0 (Allow), 2 (Allow), 3 (Block), 4 (Block)</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-semibold">Available Copies (Total = 5)</td>
                            <td className="py-2.5 px-3">0 &le; avail &le; 5</td>
                            <td className="py-2.5 px-3">avail &lt; 0, avail &gt; 5</td>
                            <td className="py-2.5 px-3">-1 (Err), 0 (Valid), 1 (Valid), 5 (Valid), 6 (Err)</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-semibold">Overdue Days (Fine)</td>
                            <td className="py-2.5 px-3">ret &le; due (0d) | ret &gt; due (&ge;1d)</td>
                            <td className="py-2.5 px-3">ret &lt; issueDate (Invalid)</td>
                            <td className="py-2.5 px-3">-1d (0 fine), 0d (0 fine), 1d (₹5), 30d (₹150)</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-sans font-semibold">Semester</td>
                            <td className="py-2.5 px-3">Integer 1..12</td>
                            <td className="py-2.5 px-3">&le; 0, &ge; 13, non-integer</td>
                            <td className="py-2.5 px-3">0 (Err), 1 (Valid), 6 (Valid), 12 (Valid), 13 (Err)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedLabSheet === 'lab4' && (
                  <div className="space-y-5">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lab Sheet 4: Decision Tables &amp; State Transition Diagram
                    </h3>
                    {/* State Transition SVG Diagram */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-700 mb-3">
                        Book Copy &amp; Borrowing Lifecycle State Transitions
                      </p>
                      <svg viewBox="0 0 720 190" className="w-full h-auto max-w-2xl mx-auto">
                        <defs>
                          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
                          </marker>
                        </defs>
                        {/* Nodes */}
                        <rect x="20" y="70" width="120" height="44" rx="8" fill="#ffffff" stroke="#16a34a" strokeWidth="2" />
                        <text x="80" y="96" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0f172a">Available</text>

                        <rect x="210" y="70" width="120" height="44" rx="8" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                        <text x="270" y="96" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0f172a">Borrowed</text>

                        <rect x="400" y="20" width="120" height="44" rx="8" fill="#ffffff" stroke="#dc2626" strokeWidth="2" />
                        <text x="460" y="46" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0f172a">Overdue</text>

                        <rect x="570" y="70" width="120" height="44" rx="8" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                        <text x="630" y="96" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0f172a">Returned</text>

                        {/* Edges */}
                        <path d="M 140 92 L 204 92" stroke="#2563eb" strokeWidth="1.8" markerEnd="url(#arrow)" fill="none" />
                        <text x="172" y="84" textAnchor="middle" fontSize="10" fill="#475569">Issue()</text>

                        <path d="M 330 82 L 395 48" stroke="#2563eb" strokeWidth="1.8" markerEnd="url(#arrow)" fill="none" />
                        <text x="355" y="55" textAnchor="middle" fontSize="10" fill="#475569">Due &lt; Today</text>

                        <path d="M 330 98 L 564 98" stroke="#2563eb" strokeWidth="1.8" markerEnd="url(#arrow)" fill="none" />
                        <text x="450" y="114" textAnchor="middle" fontSize="10" fill="#475569">Return(on/before due, ₹0)</text>

                        <path d="M 520 48 L 570 80" stroke="#2563eb" strokeWidth="1.8" markerEnd="url(#arrow)" fill="none" />
                        <text x="560" y="53" textAnchor="middle" fontSize="10" fill="#475569">Return(+Fine)</text>

                        <path d="M 630 114 C 630 170, 80 170, 80 120" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" fill="none" />
                        <text x="355" y="162" textAnchor="middle" fontSize="10" fill="#15803d">Copy Restocked (availableCopies + 1)</text>
                      </svg>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Decision Rule (Issue Book)</th>
                            <th className="py-2 px-3">Valid Student?</th>
                            <th className="py-2 px-3">Copies &gt; 0?</th>
                            <th className="py-2 px-3">Below Limit?</th>
                            <th className="py-2 px-3">Expected Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="py-2 px-3">R1</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3 text-emerald-700 font-sans font-semibold">Issue Allowed (HTTP 201)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3">R2</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3">N</td>
                            <td className="py-2 px-3 text-red-600 font-sans">Blocked: Borrowing limit reached (409)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3">R3</td>
                            <td className="py-2 px-3">Y</td>
                            <td className="py-2 px-3">N</td>
                            <td className="py-2 px-3">—</td>
                            <td className="py-2 px-3 text-red-600 font-sans">Blocked: 0 available copies (409)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3">R4</td>
                            <td className="py-2 px-3">N</td>
                            <td className="py-2 px-3">—</td>
                            <td className="py-2 px-3">—</td>
                            <td className="py-2 px-3 text-red-600 font-sans">Blocked: Invalid student (404)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedLabSheet === 'lab5' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lab Sheet 5: Control Flow Graph (CFG) &amp; Cyclomatic Complexity (Fine Calculator)
                    </h3>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <svg viewBox="0 0 680 230" className="w-full h-auto max-w-2xl mx-auto">
                        <defs>
                          <marker id="cfg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
                          </marker>
                        </defs>
                        {[
                          { id: 'N1', x: 50, y: 110, label: 'Start' },
                          { id: 'N2', x: 150, y: 110, label: 'Valid Date?' },
                          { id: 'N3', x: 260, y: 50, label: 'Error' },
                          { id: 'N4', x: 270, y: 110, label: 'ret < issue?' },
                          { id: 'N5', x: 400, y: 110, label: 'ret <= due?' },
                          { id: 'N6', x: 510, y: 50, label: 'Fine = 0' },
                          { id: 'N7', x: 510, y: 170, label: 'days * rate' },
                          { id: 'N8', x: 630, y: 110, label: 'End' },
                        ].map((n) => (
                          <g key={n.id}>
                            <circle cx={n.x} cy={n.y} r="24" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                            <text x={n.x} y={n.y - 3} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e40af">
                              {n.id}
                            </text>
                            <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize="9" fill="#334155">
                              {n.label}
                            </text>
                          </g>
                        ))}
                        <line x1="74" y1="110" x2="122" y2="110" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="170" y1="96" x2="235" y2="60" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="174" y1="110" x2="242" y2="110" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="270" y1="86" x2="263" y2="76" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="294" y1="110" x2="372" y2="110" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="420" y1="96" x2="486" y2="60" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="420" y1="124" x2="486" y2="160" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="534" y1="60" x2="606" y2="100" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <line x1="534" y1="160" x2="606" y2="120" stroke="#334155" strokeWidth="1.5" markerEnd="url(#cfg-arrow)" />
                        <path d="M 284 44 C 420 10, 560 20, 620 86" stroke="#334155" strokeWidth="1.5" fill="none" markerEnd="url(#cfg-arrow)" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="rounded-lg border border-slate-200 p-3">Nodes (N) = 8 · Edges (E) = 10</div>
                      <div className="rounded-lg border border-slate-200 p-3">Decision Points (P) = 3</div>
                      <div className="rounded-lg border border-slate-200 p-3 font-semibold text-blue-700">
                        V(G) = E - N + 2 = 4 Paths
                      </div>
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1 font-mono">
                      <li>Path 1 (Invalid Date): N1 → N2 → N3 → N8</li>
                      <li>Path 2 (Return &lt; Issue): N1 → N2 → N4 → N3 → N8</li>
                      <li>Path 3 (On-time Return): N1 → N2 → N4 → N5 → N6 → N8</li>
                      <li>Path 4 (Overdue Fine): N1 → N2 → N4 → N5 → N7 → N8</li>
                    </ul>
                  </div>
                )}

                {selectedLabSheet === 'lab6-13' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Labs 6–13: Automated Testing Suites &amp; Artifacts in Repository
                    </h3>
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg text-xs">
                      <div className="p-3.5">
                        <p className="font-semibold text-slate-900">Lab 6 · JUnit 4 Java Unit Testing Module</p>
                        <p className="text-slate-600 mt-1">
                          Located at <span className="font-mono">testing-lab/junit-module/</span> (Maven `pom.xml`, `FineCalculatorTest.java`, `BorrowValidatorTest.java`). Demonstrates unit testing of equivalent core business logic in Java.
                        </p>
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-slate-900">Lab 7 · Selenium IDE Scenarios</p>
                        <p className="text-slate-600 mt-1">
                          Located at <span className="font-mono">testing-lab/selenium-ide/SELENIUM_IDE_SCENARIOS.md</span> with exact recording &amp; replay steps matching LibTrack&apos;s `data-testid` selectors.
                        </p>
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-slate-900">Labs 8 &amp; 10 · Selenium WebDriver + JUnit 4 Suite</p>
                        <p className="text-slate-600 mt-1">
                          Located at <span className="font-mono">testing-lab/selenium-webdriver/</span> with `@Before` setup, `@After` teardown, Chrome/Edge driver switching, and JUnit assertions.
                        </p>
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-slate-900">Lab 9 · Cross-Browser Testing Checklist (Chrome &amp; Edge)</p>
                        <p className="text-slate-600 mt-1">
                          Checklist documented in <span className="font-mono">testing-lab/LAB_SHEETS_1_TO_14.md</span>. Results remain marked <em>Not Executed</em> until you run them in Chrome and Edge locally.
                        </p>
                      </div>
                      <div className="p-3.5">
                        <p className="font-semibold text-slate-900">Lab 13 · Apache JMeter Performance Testing</p>
                        <p className="text-slate-600 mt-1">
                          Located at <span className="font-mono">testing-lab/jmeter/LibTrack_Performance_Test.jmx</span> and <span className="font-mono">JMETER_GUIDE.md</span>. Includes Thread Group, HTTP Cookie Manager, Samplers, Response Assertions, Summary Report, and View Results Tree.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Test Case Add/Edit Modal */}
      <Modal
        open={tcModalOpen}
        onClose={() => setTcModalOpen(false)}
        title={editingTc ? `Execute / Edit ${editingTc.testCaseId}` : 'Add Test Case'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={saveTc} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Test Case ID</label>
              <input
                type="text"
                required
                disabled={Boolean(editingTc)}
                value={tcForm.testCaseId}
                onChange={(e) => setTcForm((s) => ({ ...s, testCaseId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Module</label>
              <input
                type="text"
                required
                value={tcForm.module}
                onChange={(e) => setTcForm((s) => ({ ...s, module: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Technique</label>
              <input
                type="text"
                required
                value={tcForm.technique}
                onChange={(e) => setTcForm((s) => ({ ...s, technique: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Test Scenario</label>
            <input
              type="text"
              required
              value={tcForm.testScenario}
              onChange={(e) => setTcForm((s) => ({ ...s, testScenario: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Test Input</label>
            <input
              type="text"
              value={tcForm.testInput}
              onChange={(e) => setTcForm((s) => ({ ...s, testInput: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expected Result</label>
              <textarea
                rows={2}
                required
                value={tcForm.expectedResult}
                onChange={(e) => setTcForm((s) => ({ ...s, expectedResult: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Actual Result</label>
              <textarea
                rows={2}
                value={tcForm.actualResult}
                onChange={(e) => setTcForm((s) => ({ ...s, actualResult: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Execution Status</label>
              <select
                value={tcForm.status}
                onChange={(e) => setTcForm((s) => ({ ...s, status: e.target.value as TestCaseStatus }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {TEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Linked Defect ID (Optional)</label>
              <input
                type="text"
                value={tcForm.defectId}
                onChange={(e) => setTcForm((s) => ({ ...s, defectId: e.target.value }))}
                placeholder="e.g., BUG-001"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTcModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={tcSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {tcSaving ? 'Saving...' : 'Save Test Case'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Defect Add/Edit Modal */}
      <Modal
        open={defectModalOpen}
        onClose={() => setDefectModalOpen(false)}
        title={editingDefect ? `Update Defect · ${editingDefect.defectId}` : 'Report New Defect'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={saveDefect} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Defect ID</label>
              <input
                type="text"
                required
                disabled={Boolean(editingDefect)}
                value={defectForm.defectId}
                onChange={(e) => setDefectForm((s) => ({ ...s, defectId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Related Test Case</label>
              <input
                type="text"
                value={defectForm.relatedTestCase}
                onChange={(e) => setDefectForm((s) => ({ ...s, relatedTestCase: e.target.value }))}
                placeholder="TC-009"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date Reported</label>
              <input
                type="date"
                required
                value={defectForm.dateReported}
                onChange={(e) => setDefectForm((s) => ({ ...s, dateReported: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Title / Summary</label>
            <input
              type="text"
              required
              value={defectForm.title}
              onChange={(e) => setDefectForm((s) => ({ ...s, title: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={defectForm.description}
              onChange={(e) => setDefectForm((s) => ({ ...s, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Steps to Reproduce</label>
            <textarea
              rows={2}
              required
              value={defectForm.stepsToReproduce}
              onChange={(e) => setDefectForm((s) => ({ ...s, stepsToReproduce: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expected Result</label>
              <input
                type="text"
                required
                value={defectForm.expectedResult}
                onChange={(e) => setDefectForm((s) => ({ ...s, expectedResult: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Actual Result</label>
              <input
                type="text"
                required
                value={defectForm.actualResult}
                onChange={(e) => setDefectForm((s) => ({ ...s, actualResult: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
              <select
                value={defectForm.severity}
                onChange={(e) => setDefectForm((s) => ({ ...s, severity: e.target.value as DefectSeverity }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {DEFECT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={defectForm.priority}
                onChange={(e) => setDefectForm((s) => ({ ...s, priority: e.target.value as DefectPriority }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {DEFECT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lifecycle Status</label>
              <select
                value={defectForm.status}
                onChange={(e) => setDefectForm((s) => ({ ...s, status: e.target.value as DefectStatus }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {DEFECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDefectModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={defectSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {defectSaving ? 'Saving...' : 'Save Defect'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTcTarget)}
        onClose={() => setDeleteTcTarget(null)}
        onConfirm={deleteTc}
        title="Delete Test Case"
        message={deleteTcTarget ? `Delete test case ${deleteTcTarget.testCaseId}?` : ''}
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={Boolean(deleteDefectTarget)}
        onClose={() => setDeleteDefectTarget(null)}
        onConfirm={deleteDefect}
        title="Delete Defect Report"
        message={deleteDefectTarget ? `Delete defect ${deleteDefectTarget.defectId}?` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
