import React, { useEffect, useState } from 'react';
import { BookOpenCheck, ShieldCheck, UserPlus, LogIn, AlertCircle, Lock } from 'lucide-react';
import { authApi, setAuthToken } from '../lib/api';
import type { User } from '../types';

interface AuthViewProps {
  onAuthenticated: (user: User) => void;
}

type AuthMode = 'login' | 'setup-admin' | 'register-student';

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Initial Admin Setup state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');

  // Student Registration state
  const [stuId, setStuId] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuDept, setStuDept] = useState('Computer Science');
  const [stuSem, setStuSem] = useState('6');
  const [stuPhone, setStuPhone] = useState('');
  const [stuPassword, setStuPassword] = useState('');

  useEffect(() => {
    let active = true;
    authApi
      .setupStatus()
      .then((res) => {
        if (!active) return;
        setNeedsAdminSetup(res.needsAdminSetup);
        setMode(res.needsAdminSetup ? 'setup-admin' : 'login');
      })
      .catch(() => {
        if (active) setMode('login');
      })
      .finally(() => {
        if (active) setCheckingSetup(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await authApi.login({ email: loginEmail.trim(), password: loginPassword });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (adminPassword !== adminConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.setupAdmin({
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create administrator account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await authApi.registerStudent({
        studentId: stuId.trim(),
        fullName: stuName.trim(),
        email: stuEmail.trim(),
        department: stuDept.trim(),
        semester: Number(stuSem),
        phone: stuPhone.trim(),
        password: stuPassword,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register student account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm space-y-4 animate-pulse">
          <div className="h-7 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Institutional Overview Panel */}
      <div className="lg:w-[44%] bg-slate-900 text-white p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">LibTrack</span>
          </div>

          <div className="mt-14 max-w-md">
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-white">
              Library Management &amp; Circulation Control
            </h1>
            <p className="mt-4 text-sm lg:text-base text-slate-300 leading-relaxed">
              Manage catalog inventory, student memberships, atomic book issuing and returns, configurable overdue fine calculation, and integrated Software Testing Lab documentation.
            </p>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-8 text-xs text-slate-300">
          <div>
            <p className="font-semibold text-white">Role-Based Access Control</p>
            <p className="mt-1 text-slate-400">
              Administrators manage catalog &amp; circulation; students track availability and personal borrowing history.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Testing Lab Ready</p>
            <p className="mt-1 text-slate-400">
              Includes execution tracking, defect workflow, CFG &amp; state diagrams, JUnit 4, Selenium, and JMeter suites.
            </p>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {!needsAdminSetup && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register-student');
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'register-student'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Student Registration
              </button>
            </div>
          )}

          {mode === 'setup-admin' && (
            <div>
              <div className="flex items-center gap-2.5 text-blue-700 mb-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">First-Time Setup</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Create Administrator Account</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                No administrator exists yet. Configure the primary librarian/admin account to unlock LibTrack.
              </p>

              {error && (
                <div
                  role="alert"
                  data-testid="auth-error"
                  className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSetupAdmin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="setup-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Administrator Full Name
                  </label>
                  <input
                    id="setup-name"
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g., Dr. Kavita Rao"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="setup-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Administrator Email
                  </label>
                  <input
                    id="setup-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="librarian@college.edu"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="setup-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password (minimum 8 characters)
                  </label>
                  <input
                    id="setup-password"
                    type="password"
                    required
                    minLength={8}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="setup-confirm" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="setup-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="setup-admin-submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Creating Administrator...' : 'Initialize LibTrack Admin'}
                </button>
              </form>
            </div>
          )}

          {mode === 'login' && (
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Sign in to LibTrack</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your registered administrator or student credentials.
              </p>

              {error && (
                <div
                  role="alert"
                  data-testid="auth-error"
                  className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    data-testid="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    id="login-password"
                    data-testid="login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="login-submit"
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {mode === 'register-student' && (
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Student Portal Sign Up</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a student account to browse the catalog and track your borrowed books.
              </p>

              {error && (
                <div
                  role="alert"
                  data-testid="auth-error"
                  className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleStudentRegister} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-stuid" className="block text-xs font-medium text-slate-700 mb-1">
                      Student ID
                    </label>
                    <input
                      id="reg-stuid"
                      type="text"
                      required
                      value={stuId}
                      onChange={(e) => setStuId(e.target.value)}
                      placeholder="STU-2026-010"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-sem" className="block text-xs font-medium text-slate-700 mb-1">
                      Semester
                    </label>
                    <input
                      id="reg-sem"
                      type="number"
                      min={1}
                      max={12}
                      required
                      value={stuSem}
                      onChange={(e) => setStuSem(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={stuName}
                    onChange={(e) => setStuName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 mb-1">
                    College Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={stuEmail}
                    onChange={(e) => setStuEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-dept" className="block text-xs font-medium text-slate-700 mb-1">
                      Department
                    </label>
                    <input
                      id="reg-dept"
                      type="text"
                      required
                      value={stuDept}
                      onChange={(e) => setStuDept(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="reg-phone"
                      type="text"
                      required
                      value={stuPhone}
                      onChange={(e) => setStuPhone(e.target.value)}
                      placeholder="+91-9876543210"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Password (min 8 characters)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={8}
                    value={stuPassword}
                    onChange={(e) => setStuPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Creating Account...' : 'Create Student Account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
