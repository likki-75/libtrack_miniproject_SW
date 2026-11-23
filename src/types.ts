export type UserRole = 'admin' | 'student';

export interface User {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentId: string | null;
  createdAt: string;
}

export interface Book {
  id: number;
  bookId: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  publicationYear: number;
  totalCopies: number;
  availableCopies: number;
  description: string;
  activeBorrowCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: number;
  studentId: string;
  fullName: string;
  email: string;
  department: string;
  semester: number;
  phone: string;
  activeBorrowCount?: number;
  totalBorrowCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BorrowStatus = 'Borrowed' | 'Overdue' | 'Returned';

export interface BorrowRecord {
  id: number;
  recordId: string;
  studentId: string;
  studentName: string;
  bookId: string;
  bookTitle: string;
  isbn: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: BorrowStatus;
  overdueDays: number;
  fineAmount: number;
  issuedBy: string;
  returnedBy: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type TestCaseStatus = 'Pass' | 'Fail' | 'Blocked' | 'Not Executed';

export interface TestCase {
  id: number;
  testCaseId: string;
  module: string;
  technique: string;
  testScenario: string;
  testInput: string;
  expectedResult: string;
  actualResult: string;
  status: TestCaseStatus;
  defectId: string | null;
  executedBy: string;
  updatedAt: string;
}

export type DefectSeverity = 'Blocker' | 'Critical' | 'Major' | 'Minor' | 'Trivial';
export type DefectPriority = 'P1 - Urgent' | 'P2 - High' | 'P3 - Medium' | 'P4 - Low';
export type DefectStatus = 'New' | 'Open' | 'In Progress' | 'Fixed' | 'Retested' | 'Closed';

export interface Defect {
  id: number;
  defectId: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  severity: DefectSeverity;
  priority: DefectPriority;
  status: DefectStatus;
  relatedTestCase: string;
  dateReported: string;
  updatedAt: string;
}

export interface LibrarySettings {
  id: string;
  libraryName: string;
  borrowingDurationDays: number;
  maxBorrowingLimit: number;
  finePerOverdueDay: number;
  currencySymbol: string;
  preventDuplicateActiveIssue: boolean;
  updatedAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  performedBy: string;
  role: string;
  createdAt: string;
}

export interface DashboardStats {
  totalBooks: number;
  totalCopies: number;
  totalAvailableCopies: number;
  currentlyBorrowed: number;
  overdueBooks: number;
  totalStudents: number;
  totalBorrowRecords: number;
  totalFinesCollected: number;
  categoryDistribution: Array<{ category: string; books: number; copies: number; available: number }>;
  monthlyActivity: Array<{ month: string; issued: number; returned: number }>;
  popularBooks: Array<{ bookId: string; title: string; author: string; borrowCount: number; availableCopies: number; totalCopies: number }>;
  nearingDue: BorrowRecord[];
  recentActivity: ActivityLog[];
}

export interface ReturnPreview {
  recordId: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  dueDate: string;
  returnDate: string;
  overdueDays: number;
  finePerOverdueDay: number;
  fineAmount: number;
  currencySymbol: string;
}
