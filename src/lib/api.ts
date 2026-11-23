import type {
  Book,
  BorrowRecord,
  DashboardStats,
  Defect,
  LibrarySettings,
  ReturnPreview,
  Student,
  TestCase,
  User,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const authApi = {
  setupStatus: () => apiFetch<{ needsAdminSetup: boolean }>('/api/auth/setup-status'),
  setupAdmin: (payload: { name: string; email: string; password: string }) =>
    apiFetch<{ user: User; token: string }>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  registerStudent: (payload: {
    studentId: string;
    fullName: string;
    email: string;
    department: string;
    semester: number;
    phone: string;
    password: string;
  }) =>
    apiFetch<{ user: User; token: string }>('/api/auth/register-student', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiFetch<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => apiFetch<{ user: User }>('/api/auth/me'),
};

export const dashboardApi = {
  getStats: () => apiFetch<DashboardStats>('/api/dashboard/stats'),
};

export const booksApi = {
  list: (params?: { search?: string; category?: string; sortBy?: string; sortOrder?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category && params.category !== 'All') qs.set('category', params.category);
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    const query = qs.toString();
    return apiFetch<{ books: Book[] }>(`/api/books${query ? `?${query}` : ''}`);
  },
  get: (bookId: string) =>
    apiFetch<{ book: Book; activeBorrows: BorrowRecord[] }>(`/api/books/${encodeURIComponent(bookId)}`),
  create: (payload: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'activeBorrowCount'>) =>
    apiFetch<{ book: Book }>('/api/books', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (bookId: string, payload: Partial<Book>) =>
    apiFetch<{ book: Book }>(`/api/books/${encodeURIComponent(bookId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  delete: (bookId: string) =>
    apiFetch<{ success: boolean }>(`/api/books/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
    }),
};

export const studentsApi = {
  list: (params?: { search?: string; department?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.department && params.department !== 'All') qs.set('department', params.department);
    const query = qs.toString();
    return apiFetch<{ students: Student[] }>(`/api/students${query ? `?${query}` : ''}`);
  },
  get: (studentId: string) =>
    apiFetch<{ student: Student; history: BorrowRecord[] }>(`/api/students/${encodeURIComponent(studentId)}`),
  create: (payload: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> & { portalPassword?: string }) =>
    apiFetch<{ student: Student }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (studentId: string, payload: Partial<Student>) =>
    apiFetch<{ student: Student }>(`/api/students/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  delete: (studentId: string) =>
    apiFetch<{ success: boolean }>(`/api/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    }),
};

export const borrowApi = {
  issue: (payload: {
    studentId: string;
    bookId: string;
    issueDate: string;
    borrowingDurationDays?: number;
    notes?: string;
  }) =>
    apiFetch<{ record: BorrowRecord }>('/api/borrow/issue', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  previewReturn: (payload: { recordId: string; returnDate: string }) =>
    apiFetch<{ preview: ReturnPreview }>('/api/borrow/preview-return', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  returnBook: (payload: { recordId: string; returnDate: string; notes?: string }) =>
    apiFetch<{ record: BorrowRecord }>('/api/borrow/return', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  records: (params?: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return apiFetch<{
      records: BorrowRecord[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/borrow/records${query ? `?${query}` : ''}`);
  },
};

export const testingApi = {
  listTestCases: () => apiFetch<{ testCases: TestCase[] }>('/api/test-cases'),
  createTestCase: (payload: Omit<TestCase, 'id' | 'executedBy' | 'updatedAt'>) =>
    apiFetch<{ testCase: TestCase }>('/api/test-cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTestCase: (testCaseId: string, payload: Partial<TestCase>) =>
    apiFetch<{ testCase: TestCase }>(`/api/test-cases/${encodeURIComponent(testCaseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTestCase: (testCaseId: string) =>
    apiFetch<{ success: boolean }>(`/api/test-cases/${encodeURIComponent(testCaseId)}`, {
      method: 'DELETE',
    }),
  listDefects: () => apiFetch<{ defects: Defect[] }>('/api/defects'),
  createDefect: (payload: Omit<Defect, 'id' | 'updatedAt'>) =>
    apiFetch<{ defect: Defect }>('/api/defects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateDefect: (defectId: string, payload: Partial<Defect>) =>
    apiFetch<{ defect: Defect }>(`/api/defects/${encodeURIComponent(defectId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteDefect: (defectId: string) =>
    apiFetch<{ success: boolean }>(`/api/defects/${encodeURIComponent(defectId)}`, {
      method: 'DELETE',
    }),
};

export const settingsApi = {
  get: () => apiFetch<{ settings: LibrarySettings }>('/api/settings'),
  update: (payload: Partial<LibrarySettings>) =>
    apiFetch<{ settings: LibrarySettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  seedDemo: () =>
    apiFetch<{ success: boolean; inserted: Record<string, number> }>('/api/admin/seed', {
      method: 'POST',
    }),
  resetData: () =>
    apiFetch<{ success: boolean }>('/api/admin/reset', {
      method: 'POST',
    }),
};
