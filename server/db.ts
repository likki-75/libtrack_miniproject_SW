import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { addDaysToIsoDate, getTodayIsoDate } from './domain.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'libtrack.sqlite');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    studentId TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId TEXT NOT NULL UNIQUE,
    isbn TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    publisher TEXT NOT NULL,
    publicationYear INTEGER NOT NULL,
    totalCopies INTEGER NOT NULL CHECK (totalCopies >= 1),
    availableCopies INTEGER NOT NULL CHECK (availableCopies >= 0 AND availableCopies <= totalCopies),
    description TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT NOT NULL UNIQUE,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
    phone TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS borrowRecords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recordId TEXT NOT NULL UNIQUE,
    studentId TEXT NOT NULL,
    studentName TEXT NOT NULL,
    bookId TEXT NOT NULL,
    bookTitle TEXT NOT NULL,
    isbn TEXT NOT NULL,
    issueDate TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    returnDate TEXT,
    status TEXT NOT NULL CHECK (status IN ('Borrowed', 'Overdue', 'Returned')),
    overdueDays INTEGER NOT NULL DEFAULT 0,
    fineAmount REAL NOT NULL DEFAULT 0,
    issuedBy TEXT NOT NULL,
    returnedBy TEXT,
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS testCases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testCaseId TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    technique TEXT NOT NULL,
    testScenario TEXT NOT NULL,
    testInput TEXT NOT NULL,
    expectedResult TEXT NOT NULL,
    actualResult TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('Pass', 'Fail', 'Blocked', 'Not Executed')),
    defectId TEXT,
    executedBy TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS defects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    defectId TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    stepsToReproduce TEXT NOT NULL,
    expectedResult TEXT NOT NULL,
    actualResult TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Blocker', 'Critical', 'Major', 'Minor', 'Trivial')),
    priority TEXT NOT NULL CHECK (priority IN ('P1 - Urgent', 'P2 - High', 'P3 - Medium', 'P4 - Low')),
    status TEXT NOT NULL CHECK (status IN ('New', 'Open', 'In Progress', 'Fixed', 'Retested', 'Closed')),
    relatedTestCase TEXT NOT NULL DEFAULT '',
    dateReported TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    libraryName TEXT NOT NULL,
    borrowingDurationDays INTEGER NOT NULL CHECK (borrowingDurationDays >= 1),
    maxBorrowingLimit INTEGER NOT NULL CHECK (maxBorrowingLimit >= 1),
    finePerOverdueDay REAL NOT NULL CHECK (finePerOverdueDay >= 0),
    currencySymbol TEXT NOT NULL,
    preventDuplicateActiveIssue INTEGER NOT NULL DEFAULT 1,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activityLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    details TEXT NOT NULL,
    performedBy TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

const nowIso = new Date().toISOString();
db.prepare(
  `INSERT OR IGNORE INTO settings (id, libraryName, borrowingDurationDays, maxBorrowingLimit, finePerOverdueDay, currencySymbol, preventDuplicateActiveIssue, updatedAt)
   VALUES ('default', 'LibTrack University Central Library', 14, 3, 5, '₹', 1, ?)`
).run(nowIso);

export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  performedBy: string,
  role: string
): void {
  db.prepare(
    `INSERT INTO activityLogs (action, entityType, entityId, details, performedBy, role, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(action, entityType, entityId, details, performedBy, role, new Date().toISOString());
}

export function syncOverdueStatuses(): void {
  const today = getTodayIsoDate();
  db.prepare(
    `UPDATE borrowRecords
     SET status = 'Overdue', updatedAt = ?
     WHERE status = 'Borrowed' AND returnDate IS NULL AND dueDate < ?`
  ).run(new Date().toISOString(), today);
}

export function seedSampleData(performedBy: string): { inserted: Record<string, number> } {
  const today = getTodayIsoDate();
  const ts = new Date().toISOString();

  return runInTransaction(() => {
    const books = [
      ['BK-1001', '9780132350884', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 'Software Engineering', 'Prentice Hall', 2008, 6, 4, 'Practical principles, patterns, and practices for writing clean, maintainable object-oriented software.'],
      ['BK-1002', '9780321751041', 'The Art of Software Testing', 'Glenford J. Myers', 'Software Testing', 'Wiley', 2011, 5, 3, 'Foundational reference on black-box testing, boundary value analysis, equivalence partitioning, and debugging.'],
      ['BK-1003', '9780262046305', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Algorithms', 'MIT Press', 2022, 8, 6, 'Comprehensive textbook covering data structures, graph algorithms, dynamic programming, and complexity analysis.'],
      ['BK-1004', '9781449373320', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Distributed Systems', 'O\'Reilly Media', 2017, 4, 2, 'Architecture guide for reliable, scalable, and maintainable data systems, replication, and transactions.'],
      ['BK-1005', '9780134685991', 'Effective Java', 'Joshua Bloch', 'Programming Languages', 'Addison-Wesley', 2018, 5, 4, 'Best practices for the Java platform including generics, lambdas, concurrency, and testing patterns.'],
      ['BK-1006', '9780133594140', 'Computer Networking: A Top-Down Approach', 'James F. Kurose', 'Networking', 'Pearson', 2020, 6, 6, 'Protocol layering, TCP/IP, HTTP, DNS, routing algorithms, and network security fundamentals.'],
      ['BK-1007', '9781119456339', 'Operating System Concepts', 'Abraham Silberschatz', 'Operating Systems', 'Wiley', 2018, 4, 3, 'Process synchronization, deadlocks, memory management, file systems, and virtual machines.'],
      ['BK-1008', '9780078022159', 'Database System Concepts', 'Henry F. Korth', 'Databases', 'McGraw-Hill', 2019, 5, 5, 'Relational model, SQL, normalization, transaction ACID properties, and concurrency control.'],
      ['BK-1009', '9780134757599', 'Refactoring: Improving the Design of Existing Code', 'Martin Fowler', 'Software Engineering', 'Addison-Wesley', 2018, 3, 2, 'Catalog of behavior-preserving code transformations backed by automated unit test suites.'],
      ['BK-1010', '9780131103627', 'The C Programming Language', 'Brian W. Kernighan', 'Programming Languages', 'Prentice Hall', 1988, 4, 4, 'Classic manual on C syntax, pointers, memory management, and Unix system interfaces.'],
    ] as const;

    let booksAdded = 0;
    const insertBook = db.prepare(
      `INSERT OR IGNORE INTO books (bookId, isbn, title, author, category, publisher, publicationYear, totalCopies, availableCopies, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const b of books) {
      const r = insertBook.run(...b, ts, ts);
      booksAdded += Number(r.changes);
    }

    const students = [
      ['STU-2026-001', 'Aarav Sharma', 'aarav.sharma@college.edu', 'Computer Science', 6, '+91-9876543210'],
      ['STU-2026-002', 'Priya Nair', 'priya.nair@college.edu', 'Computer Science', 6, '+91-9876543211'],
      ['STU-2026-003', 'Rohan Verma', 'rohan.verma@college.edu', 'Information Technology', 4, '+91-9876543212'],
      ['STU-2026-004', 'Sneha Kulkarni', 'sneha.kulkarni@college.edu', 'Software Engineering', 8, '+91-9876543213'],
      ['STU-2026-005', 'Vikram Reddy', 'vikram.reddy@college.edu', 'Electronics & Comm.', 4, '+91-9876543214'],
      ['STU-2026-006', 'Ananya Iyer', 'ananya.iyer@college.edu', 'Data Science', 2, '+91-9876543215'],
    ] as const;

    let studentsAdded = 0;
    const insertStudent = db.prepare(
      `INSERT OR IGNORE INTO students (studentId, fullName, email, department, semester, phone, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of students) {
      const r = insertStudent.run(...s, ts, ts);
      studentsAdded += Number(r.changes);
    }

    const records = [
      // Active Borrowed (not overdue)
      ['BR-1001', 'STU-2026-001', 'Aarav Sharma', 'BK-1001', 'Clean Code: A Handbook of Agile Software Craftsmanship', '9780132350884', addDaysToIsoDate(today, -4), addDaysToIsoDate(today, 10), null, 'Borrowed', 0, 0, performedBy, null, 'Semester 6 SE Lab reading'],
      ['BR-1002', 'STU-2026-002', 'Priya Nair', 'BK-1003', 'Introduction to Algorithms', '9780262046305', addDaysToIsoDate(today, -12), addDaysToIsoDate(today, 2), null, 'Borrowed', 0, 0, performedBy, null, 'Due in 2 days'],
      ['BR-1003', 'STU-2026-004', 'Sneha Kulkarni', 'BK-1004', 'Designing Data-Intensive Applications', '9781449373320', addDaysToIsoDate(today, -11), addDaysToIsoDate(today, 3), null, 'Borrowed', 0, 0, performedBy, null, 'Capstone project reference'],
      ['BR-1004', 'STU-2026-003', 'Rohan Verma', 'BK-1005', 'Effective Java', '9780134685991', addDaysToIsoDate(today, -6), addDaysToIsoDate(today, 8), null, 'Borrowed', 0, 0, performedBy, null, 'JUnit module reference'],
      ['BR-1005', 'STU-2026-006', 'Ananya Iyer', 'BK-1007', 'Operating System Concepts', '9781119456339', addDaysToIsoDate(today, -2), addDaysToIsoDate(today, 12), null, 'Borrowed', 0, 0, performedBy, null, ''],
      // Overdue active records
      ['BR-1006', 'STU-2026-001', 'Aarav Sharma', 'BK-1002', 'The Art of Software Testing', '9780321751041', addDaysToIsoDate(today, -20), addDaysToIsoDate(today, -6), null, 'Overdue', 0, 0, performedBy, null, 'Overdue by 6 days'],
      ['BR-1007', 'STU-2026-005', 'Vikram Reddy', 'BK-1009', 'Refactoring: Improving the Design of Existing Code', '9780134757599', addDaysToIsoDate(today, -18), addDaysToIsoDate(today, -4), null, 'Overdue', 0, 0, performedBy, null, 'Overdue by 4 days'],
      ['BR-1008', 'STU-2026-002', 'Priya Nair', 'BK-1001', 'Clean Code: A Handbook of Agile Software Craftsmanship', '9780132350884', addDaysToIsoDate(today, -15), addDaysToIsoDate(today, -1), null, 'Overdue', 0, 0, performedBy, null, 'Overdue by 1 day'],
      // Returned historical records across recent months
      ['BR-1009', 'STU-2026-003', 'Rohan Verma', 'BK-1002', 'The Art of Software Testing', '9780321751041', addDaysToIsoDate(today, -35), addDaysToIsoDate(today, -21), addDaysToIsoDate(today, -22), 'Returned', 0, 0, performedBy, performedBy, 'Returned on time'],
      ['BR-1010', 'STU-2026-004', 'Sneha Kulkarni', 'BK-1008', 'Database System Concepts', '9780078022159', addDaysToIsoDate(today, -45), addDaysToIsoDate(today, -31), addDaysToIsoDate(today, -28), 'Returned', 3, 15, performedBy, performedBy, 'Returned 3 days late'],
      ['BR-1011', 'STU-2026-006', 'Ananya Iyer', 'BK-1006', 'Computer Networking: A Top-Down Approach', '9780133594140', addDaysToIsoDate(today, -65), addDaysToIsoDate(today, -51), addDaysToIsoDate(today, -51), 'Returned', 0, 0, performedBy, performedBy, 'Returned on due date'],
      ['BR-1012', 'STU-2026-001', 'Aarav Sharma', 'BK-1003', 'Introduction to Algorithms', '9780262046305', addDaysToIsoDate(today, -80), addDaysToIsoDate(today, -66), addDaysToIsoDate(today, -61), 'Returned', 5, 25, performedBy, performedBy, 'Fine settled on return'],
    ] as const;

    let recordsAdded = 0;
    const insertBorrow = db.prepare(
      `INSERT OR IGNORE INTO borrowRecords (recordId, studentId, studentName, bookId, bookTitle, isbn, issueDate, dueDate, returnDate, status, overdueDays, fineAmount, issuedBy, returnedBy, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of records) {
      const res = insertBorrow.run(...r, ts, ts);
      recordsAdded += Number(res.changes);
    }

    // Also add 2 more active borrows if needed? No, notice availableCopies in books above already reflects active borrows:
    // BK-1001: total 6, active BR-1001 + BR-1008 = 2 -> available 4
    // BK-1002: total 5, active BR-1006 = 1 -> wait let's match exact counts!
    // Let's keep books availableCopies accurate dynamically if seeded fresh:
    // Reconcile book availableCopies based on active borrowRecords for seeded books:
    for (const [bookId] of books) {
      const active = db
        .prepare(`SELECT COUNT(*) as cnt FROM borrowRecords WHERE bookId = ? AND status IN ('Borrowed', 'Overdue')`)
        .get(bookId) as { cnt: number };
      db.prepare(`UPDATE books SET availableCopies = MAX(0, totalCopies - ?) WHERE bookId = ?`).run(active.cnt, bookId);
    }

    const testCases = [
      ['TC-001', 'Authentication', 'Manual Testing', 'Verify valid admin login redirects to Dashboard', 'Registered admin email + valid password', 'HTTP 200 session established; Dashboard metrics rendered', 'Session cookie issued and Dashboard loaded', 'Pass', null, performedBy],
      ['TC-002', 'Authentication', 'Manual Testing', 'Verify invalid password displays descriptive error', 'Registered email + wrong password', 'HTTP 401; inline error message shown without crash', 'Displayed "Invalid email or password"', 'Pass', null, performedBy],
      ['TC-003', 'Book Management', 'BVA', 'Verify available copies cannot exceed total copies', 'totalCopies = 5, availableCopies = 6', 'Validation error blocking save', 'Returned 400 validation error as expected', 'Pass', null, performedBy],
      ['TC-004', 'Book Management', 'ECP', 'Verify invalid ISBN format is rejected on Add Book', 'ISBN = "INVALID-123"', 'Inline validation error requiring 10/13 digit ISBN', 'Rejected with ISBN format error', 'Pass', null, performedBy],
      ['TC-005', 'Issue Books', 'BVA', 'Verify borrowing limit boundary (N = maxBorrowingLimit)', 'Student has 3 active books, attempt 4th issue', 'Blocked with max borrowing limit reached message', 'Blocked 4th issue with clear limit message', 'Pass', null, performedBy],
      ['TC-006', 'Issue Books', 'Decision Table', 'Prevent issuing book when availableCopies = 0', 'Valid student + book with 0 available copies', 'Issue button disabled & backend rejects with 409', 'Prevented at UI and API level', 'Pass', null, performedBy],
      ['TC-007', 'Return Books', 'State Transition', 'Prevent duplicate return on already Returned record', 'recordId with status = Returned', 'Reject transition Returned -> Returned with error', 'Blocked with HTTP 409 error', 'Pass', null, performedBy],
      ['TC-008', 'Fine Calculator', 'CFG / Path Coverage', 'Calculate zero fine when returned on due date', 'dueDate = 2026-11-15, returnDate = 2026-11-15, rate = 5', 'overdueDays = 0, fineAmount = 0', 'overdueDays = 0, fineAmount = 0', 'Pass', null, performedBy],
      ['TC-009', 'Fine Calculator', 'CFG / Path Coverage', 'Reject return date earlier than issue date', 'issueDate = 2026-11-10, returnDate = 2026-11-08', 'Validation error: return date cannot precede issue date', 'Flagged validation message on custom return date', 'Fail', 'BUG-001', performedBy],
      ['TC-010', 'Student Management', 'ECP', 'Prevent duplicate Student ID creation', 'Existing studentId = STU-2026-001', 'Conflict error preventing duplicate student record', 'Rejected with 409 Conflict', 'Pass', null, performedBy],
      ['TC-011', 'Borrowing History', 'Manual Testing', 'Verify pagination and status filter on Borrowing History', 'Filter = Overdue, Page = 1', 'Only overdue records displayed with red status indicator', 'Pending manual re-verification after UI update', 'Not Executed', null, ''],
      ['TC-012', 'Cross-Browser', 'Selenium WebDriver', 'Verify Issue Book workflow in Microsoft Edge', 'Selenium WebDriver Edge session on Issue Books', 'Book issued and availability decremented', 'Blocked until Edge WebDriver installed on lab PC', 'Blocked', 'BUG-002', performedBy],
    ] as const;

    let tcAdded = 0;
    const insertTc = db.prepare(
      `INSERT OR IGNORE INTO testCases (testCaseId, module, technique, testScenario, testInput, expectedResult, actualResult, status, defectId, executedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const tc of testCases) {
      const res = insertTc.run(...tc, ts);
      tcAdded += Number(res.changes);
    }

    const defects = [
      ['BUG-001', 'Custom return date picker allows selecting date prior to issue date in browser', 'While the backend rejects return dates earlier than issue date, the date input lacked a min attribute matching the record issueDate.', '1. Navigate to Return Books\n2. Select an active borrow record\n3. Choose a return date earlier than issueDate\n4. Observe preview', 'Date input prevents selecting dates prior to issueDate and displays clear warning.', 'Preview returns 400 error toast instead of blocking invalid date selection proactively.', 'Major', 'P2 - High', 'Fixed', 'TC-009', addDaysToIsoDate(today, -3)],
      ['BUG-002', 'Microsoft Edge WebDriver version mismatch on lab workstation', 'Selenium grid node on Lab PC #4 uses older msedgedriver binary incompatible with Edge 130.', '1. Run mvn test -Dbrowser=edge\n2. Observe SessionNotCreatedException', 'Edge browser launches and executes IssueAndReturnFlowTest.', 'SessionNotCreatedException thrown during @Before setup.', 'Minor', 'P3 - Medium', 'Open', 'TC-012', addDaysToIsoDate(today, -1)],
      ['BUG-003', 'Long book titles wrap awkwardly in narrow mobile viewports', 'Titles exceeding 65 characters caused table action buttons to wrap onto two lines at 375px width.', '1. Open Books page on 375px viewport\n2. View book with long title', 'Title truncates cleanly with ellipsis and action buttons stay single-line.', 'Action row wrapped vertically.', 'Trivial', 'P4 - Low', 'Closed', 'TC-003', addDaysToIsoDate(today, -7)],
    ] as const;

    let defectsAdded = 0;
    const insertDefect = db.prepare(
      `INSERT OR IGNORE INTO defects (defectId, title, description, stepsToReproduce, expectedResult, actualResult, severity, priority, status, relatedTestCase, dateReported, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of defects) {
      const res = insertDefect.run(...d, ts);
      defectsAdded += Number(res.changes);
    }

    logActivity(
      'SEED_DEMO_DATA',
      'system',
      'seed',
      `Seeded sample data (${booksAdded} books, ${studentsAdded} students, ${recordsAdded} borrow records, ${tcAdded} test cases, ${defectsAdded} defects)`,
      performedBy,
      'admin'
    );

    return {
      inserted: {
        books: booksAdded,
        students: studentsAdded,
        borrowRecords: recordsAdded,
        testCases: tcAdded,
        defects: defectsAdded,
      },
    };
  });
}

export function resetNonAdminData(performedBy: string): void {
  runInTransaction(() => {
    db.exec(`
      DELETE FROM borrowRecords;
      DELETE FROM books;
      DELETE FROM students;
      DELETE FROM testCases;
      DELETE FROM defects;
      DELETE FROM activityLogs;
      DELETE FROM users WHERE role != 'admin';
    `);
    logActivity('RESET_DATA', 'system', 'reset', 'Cleared all library, student, borrow, and testing lab records', performedBy, 'admin');
  });
}
