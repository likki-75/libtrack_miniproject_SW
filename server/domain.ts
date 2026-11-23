const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(dateStr: string): Date {
  if (!dateStr || !ISO_DATE_RE.test(dateStr)) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${dateStr}".`);
  }
  return utc;
}

export function addDaysToIsoDate(dateStr: string, days: number): string {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('Borrowing duration must be a non-negative integer.');
  }
  const base = parseIsoDate(dateStr);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function calculateOverdueDays(dueDateStr: string, returnDateStr: string): number {
  const due = parseIsoDate(dueDateStr);
  const ret = parseIsoDate(returnDateStr);
  const diffMs = ret.getTime() - due.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / 86_400_000);
}

export function calculateFine(
  dueDateStr: string,
  returnDateStr: string,
  finePerDay: number
): { overdueDays: number; fineAmount: number } {
  if (typeof finePerDay !== 'number' || Number.isNaN(finePerDay) || finePerDay < 0) {
    throw new Error('Fine per overdue day must be a non-negative number.');
  }
  const overdueDays = calculateOverdueDays(dueDateStr, returnDateStr);
  const fineAmount = Number((overdueDays * finePerDay).toFixed(2));
  return { overdueDays, fineAmount };
}

export function validateReturnChronology(issueDateStr: string, returnDateStr: string): void {
  const issue = parseIsoDate(issueDateStr);
  const ret = parseIsoDate(returnDateStr);
  if (ret.getTime() < issue.getTime()) {
    throw new Error(`Return date (${returnDateStr}) cannot be earlier than issue date (${issueDateStr}).`);
  }
}

export interface BookInput {
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
}

export function validateBookInput(input: Partial<BookInput>): BookInput {
  const bookId = String(input.bookId ?? '').trim().toUpperCase();
  const isbn = String(input.isbn ?? '').trim();
  const title = String(input.title ?? '').trim();
  const author = String(input.author ?? '').trim();
  const category = String(input.category ?? '').trim();
  const publisher = String(input.publisher ?? '').trim();
  const description = String(input.description ?? '').trim();
  const publicationYear = Number(input.publicationYear);
  const totalCopies = Number(input.totalCopies);
  const availableCopies = Number(input.availableCopies);

  if (!/^[A-Z0-9_-]{3,32}$/.test(bookId)) {
    throw new Error('Book ID must be 3–32 alphanumeric characters, hyphens, or underscores (e.g., BK-1001).');
  }
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  if (!/^(97(8|9))?\d{9}(\d|X)$/i.test(cleanIsbn)) {
    throw new Error('ISBN must be a valid 10-digit or 13-digit ISBN.');
  }
  if (title.length < 2 || title.length > 200) {
    throw new Error('Book title must be between 2 and 200 characters.');
  }
  if (author.length < 2 || author.length > 120) {
    throw new Error('Author name must be between 2 and 120 characters.');
  }
  if (category.length < 2 || category.length > 80) {
    throw new Error('Category must be between 2 and 80 characters.');
  }
  if (publisher.length < 2 || publisher.length > 120) {
    throw new Error('Publisher must be between 2 and 120 characters.');
  }
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(publicationYear) || publicationYear < 1450 || publicationYear > maxYear) {
    throw new Error(`Publication year must be an integer between 1450 and ${maxYear}.`);
  }
  if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 10000) {
    throw new Error('Total copies must be an integer between 1 and 10,000.');
  }
  if (!Number.isInteger(availableCopies) || availableCopies < 0 || availableCopies > totalCopies) {
    throw new Error('Available copies must be between 0 and total copies.');
  }

  return {
    bookId,
    isbn,
    title,
    author,
    category,
    publisher,
    publicationYear,
    totalCopies,
    availableCopies,
    description: description.slice(0, 1500),
  };
}

export interface StudentInput {
  studentId: string;
  fullName: string;
  email: string;
  department: string;
  semester: number;
  phone: string;
}

export function validateStudentInput(input: Partial<StudentInput>): StudentInput {
  const studentId = String(input.studentId ?? '').trim().toUpperCase();
  const fullName = String(input.fullName ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const department = String(input.department ?? '').trim();
  const semester = Number(input.semester);
  const phone = String(input.phone ?? '').trim();

  if (!/^[A-Z0-9_-]{3,32}$/.test(studentId)) {
    throw new Error('Student ID must be 3–32 alphanumeric characters, hyphens, or underscores (e.g., STU-2026-001).');
  }
  if (fullName.length < 2 || fullName.length > 120) {
    throw new Error('Full name must be between 2 and 120 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }
  if (department.length < 2 || department.length > 100) {
    throw new Error('Department must be between 2 and 100 characters.');
  }
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    throw new Error('Semester must be an integer between 1 and 12.');
  }
  if (!/^[+\d][\d\s-]{6,19}$/.test(phone)) {
    throw new Error('Phone number must contain 7–20 digits or formatting characters.');
  }

  return {
    studentId,
    fullName,
    email,
    department,
    semester,
    phone,
  };
}
