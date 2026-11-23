import React, { useCallback, useEffect, useState } from 'react';
import { authApi, setAuthToken, settingsApi } from './lib/api';
import { ToastProvider } from './components/ui/Toast';
import { AuthView } from './components/AuthView';
import { Layout, type NavSection } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { BooksView } from './components/BooksView';
import { StudentsView } from './components/StudentsView';
import { IssueBookView } from './components/IssueBookView';
import { ReturnBookView } from './components/ReturnBookView';
import { BorrowingHistoryView } from './components/BorrowingHistoryView';
import { TestingDashboardView } from './components/TestingDashboardView';
import { SettingsView } from './components/SettingsView';
import type { LibrarySettings, User } from './types';

const DEFAULT_SETTINGS: LibrarySettings = {
  id: 'default',
  libraryName: 'LibTrack University Central Library',
  borrowingDurationDays: 14,
  maxBorrowingLimit: 3,
  finePerOverdueDay: 5,
  currencySymbol: '₹',
  preventDuplicateActiveIssue: true,
  updatedAt: '',
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    try {
      const res = await settingsApi.get();
      setSettings(res.settings);
    } catch {
      // keep defaults if unauthenticated
    }
  }, []);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((res) => {
        if (active) {
          setUser(res.user);
          loadSettings();
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [loadSettings]);

  const handleAuthenticated = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setActiveNav('dashboard');
    loadSettings();
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // clear local state anyway
    }
    setAuthToken(null);
    setUser(null);
    setActiveNav('dashboard');
  };

  // Protect admin-only routes in client state as well as backend
  const handleNavigate = (next: NavSection) => {
    const adminOnly: NavSection[] = ['students', 'issue', 'return', 'settings'];
    if (user?.role !== 'admin' && adminOnly.includes(next)) {
      setActiveNav('dashboard');
      return;
    }
    setActiveNav(next);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  return (
    <Layout
      user={user}
      libraryName={settings.libraryName}
      activeNav={activeNav}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {activeNav === 'dashboard' && (
        <DashboardView
          user={user}
          currencySymbol={settings.currencySymbol}
          onNavigate={handleNavigate}
        />
      )}
      {activeNav === 'books' && <BooksView user={user} />}
      {activeNav === 'students' && user.role === 'admin' && (
        <StudentsView currencySymbol={settings.currencySymbol} />
      )}
      {activeNav === 'issue' && user.role === 'admin' && <IssueBookView settings={settings} />}
      {activeNav === 'return' && user.role === 'admin' && <ReturnBookView settings={settings} />}
      {activeNav === 'history' && (
        <BorrowingHistoryView user={user} currencySymbol={settings.currencySymbol} />
      )}
      {activeNav === 'testing' && <TestingDashboardView user={user} />}
      {activeNav === 'settings' && user.role === 'admin' && (
        <SettingsView settings={settings} onSettingsUpdated={setSettings} />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
