import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Users, AlertCircle } from 'lucide-react';
import { studentsApi } from '../lib/api';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { BorrowRecord, Student } from '../types';

interface StudentsViewProps {
  currencySymbol: string;
}

const DEFAULT_FORM = {
  studentId: '',
  fullName: '',
  email: '',
  department: 'Computer Science',
  semester: '6',
  phone: '',
  portalPassword: '',
};

export function StudentsView({ currencySymbol }: StudentsViewProps) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<BorrowRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await studentsApi.list();
      setStudents(res.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch students.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department));
    return ['All', ...Array.from(set).sort()];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesDept = deptFilter === 'All' || s.department === deptFilter;
      if (!matchesDept) return false;
      if (!q) return true;
      return (
        s.studentId.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
  }, [students, search, deptFilter]);

  const openAddModal = () => {
    setEditingStudent(null);
    const nextNum = String(students.length + 1).padStart(3, '0');
    setFormState({ ...DEFAULT_FORM, studentId: `STU-2026-${nextNum}` });
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormState({
      studentId: student.studentId,
      fullName: student.fullName,
      email: student.email,
      department: student.department,
      semester: String(student.semester),
      phone: student.phone,
      portalPassword: '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const openDetails = async (student: Student) => {
    setDetailStudent(student);
    setStudentHistory([]);
    setHistoryLoading(true);
    try {
      const res = await studentsApi.get(student.studentId);
      setDetailStudent(res.student);
      setStudentHistory(res.history);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        studentId: formState.studentId.trim().toUpperCase(),
        fullName: formState.fullName.trim(),
        email: formState.email.trim().toLowerCase(),
        department: formState.department.trim(),
        semester: Number(formState.semester),
        phone: formState.phone.trim(),
      };

      if (editingStudent) {
        await studentsApi.update(editingStudent.studentId, payload);
        showToast('success', 'Student updated', `${payload.fullName}'s profile has been updated.`);
      } else {
        await studentsApi.create({
          ...payload,
          portalPassword: formState.portalPassword || undefined,
        });
        showToast('success', 'Student registered', `${payload.fullName} (${payload.studentId}) added.`);
      }
      setFormOpen(false);
      await fetchStudents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save student.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await studentsApi.delete(deleteTarget.studentId);
      showToast('success', 'Student deleted', `${deleteTarget.fullName} removed.`);
      setDeleteTarget(null);
      await fetchStudents();
    } catch (err) {
      showToast('error', 'Delete blocked', err instanceof Error ? err.message : 'Unable to delete student.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              data-testid="student-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID, name, email, or department..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by department"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Departments' : d}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          data-testid="add-student-btn"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Student
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={fetchStudents}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900">No students found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {students.length === 0
                ? 'Register your first student member to begin issuing books.'
                : 'Try adjusting your search or department filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Full Name &amp; Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-right">Sem</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Active / Total</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((stu) => (
                  <tr key={stu.studentId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                      {stu.studentId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{stu.fullName}</p>
                      <p className="text-xs text-slate-500">{stu.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{stu.department}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {stu.semester}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{stu.phone}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      <span className={(stu.activeBorrowCount ?? 0) > 0 ? 'font-semibold text-blue-700' : 'text-slate-600'}>
                        {stu.activeBorrowCount ?? 0}
                      </span>
                      <span className="text-slate-400"> / {stu.totalBorrowCount ?? 0}</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDetails(stu)}
                          aria-label={`View ${stu.fullName} borrowing history`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(stu)}
                          aria-label={`Edit ${stu.fullName}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(stu)}
                          aria-label={`Delete ${stu.fullName}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingStudent ? `Edit Student · ${editingStudent.studentId}` : 'Register Student'}
        subtitle="Prevent duplicate Student IDs and validate contact details."
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="stu-id" className="block text-xs font-medium text-slate-700 mb-1">
                Student ID
              </label>
              <input
                id="stu-id"
                type="text"
                required
                disabled={Boolean(editingStudent)}
                value={formState.studentId}
                onChange={(e) => setFormState((s) => ({ ...s, studentId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="stu-sem" className="block text-xs font-medium text-slate-700 mb-1">
                Semester (1–12)
              </label>
              <input
                id="stu-sem"
                type="number"
                required
                min={1}
                max={12}
                value={formState.semester}
                onChange={(e) => setFormState((s) => ({ ...s, semester: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stu-name" className="block text-xs font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              id="stu-name"
              type="text"
              required
              value={formState.fullName}
              onChange={(e) => setFormState((s) => ({ ...s, fullName: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="stu-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="stu-email"
                type="email"
                required
                value={formState.email}
                onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="stu-phone" className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                id="stu-phone"
                type="text"
                required
                value={formState.phone}
                onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+91-9876543210"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stu-dept" className="block text-xs font-medium text-slate-700 mb-1">
              Department
            </label>
            <input
              id="stu-dept"
              type="text"
              required
              value={formState.department}
              onChange={(e) => setFormState((s) => ({ ...s, department: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {!editingStudent && (
            <div>
              <label htmlFor="stu-pass" className="block text-xs font-medium text-slate-700 mb-1">
                Optional Portal Login Password (min 8 chars)
              </label>
              <input
                id="stu-pass"
                type="password"
                minLength={8}
                value={formState.portalPassword}
                onChange={(e) => setFormState((s) => ({ ...s, portalPassword: e.target.value }))}
                placeholder="Leave blank if student will self-register later"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingStudent ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Details & Borrowing History Modal */}
      <Modal
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        title={detailStudent?.fullName ?? 'Student Profile'}
        subtitle={detailStudent ? `${detailStudent.studentId} · ${detailStudent.department}` : undefined}
        maxWidthClass="max-w-2xl"
      >
        {detailStudent && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-slate-900 mt-0.5 truncate">{detailStudent.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Semester</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">{detailStudent.semester}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">{detailStudent.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Student ID</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">{detailStudent.studentId}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Borrowing History</h4>
              {historyLoading ? (
                <p className="text-xs text-slate-500">Loading history...</p>
              ) : studentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center border border-slate-200 rounded-lg">
                  No borrowing records for this student yet.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Book</th>
                        <th className="py-2 px-3">Issued</th>
                        <th className="py-2 px-3">Due</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentHistory.map((rec) => (
                        <tr key={rec.recordId}>
                          <td className="py-2 px-3 font-medium text-slate-900">{rec.bookTitle}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{rec.issueDate}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{rec.dueDate}</td>
                          <td className="py-2 px-3 font-medium">
                            <span
                              className={
                                rec.status === 'Overdue'
                                  ? 'text-red-600'
                                  : rec.status === 'Returned'
                                    ? 'text-emerald-700'
                                    : 'text-blue-700'
                              }
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {currencySymbol}
                            {rec.fineAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Student Record"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.fullName} (${deleteTarget.studentId})? Deletion is automatically prevented if the student has unreturned books.`
            : ''
        }
        confirmLabel="Delete Student"
      />
    </div>
  );
}
