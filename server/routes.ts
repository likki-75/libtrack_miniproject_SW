import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  clearSessionCookie,
  extractTokenFromRequest,
  hashPassword,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth.ts';
import {
  db,
  logActivity,
  resetNonAdminData,
  runInTransaction,
  seedSampleData,
  syncOverdueStatuses,
} from './db.ts';
import {
  addDaysToIsoDate,
  calculateFine,
  getTodayIsoDate,
  parseIsoDate,
  validateBookInput,
  validateReturnChronology,
  validateStudentInput,
} from './domain.ts';
import type { User, UserRole } from '../src/types.ts';

interface AuthedRequest extends Request {
  user?: User;
}

function getUserByUid(uid: string): User | null {
  const row = db
    .prepare('SELECT id, uid, name, email, role, studentId, createdAt FROM users WHERE uid = ?')
    .get(uid) as User | undefined;
  return row ?? null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const user = getUserByUid(payload.uid);
  if (!user) {
    res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges are required for this action.' });
    return;
  }
  next();
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'LibTrack API', timestamp: new Date().toISOString() });
  });

  // --- AUTHENTICATION ---
  router.get('/auth/setup-status', (_req, res) => {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as { cnt: number };
    res.json({ needsAdminSetup: row.cnt === 0 });
  });

  router.post('/auth/setup-admin', (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');

      if (name.length < 2 || name.length > 100) {
        res.status(400).json({ error: 'Full name must be between 2 and 100 characters.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        return;
      }

      const created = runInTransaction(() => {
        const countRow = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as { cnt: number };
        if (countRow.cnt > 0) {
          throw Object.assign(new Error('Initial administrator setup is already complete.'), { status: 403 });
        }
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingEmail) {
          throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
        }

        const uid = `usr_${crypto.randomUUID()}`;
        const passwordHash = hashPassword(password);
        const createdAt = new Date().toISOString();

        db.prepare(
          `INSERT INTO users (uid, name, email, passwordHash, role, studentId, createdAt)
           VALUES (?, ?, ?, ?, 'admin', NULL, ?)`
        ).run(uid, name, email, passwordHash, createdAt);

        logActivity('ADMIN_SETUP', 'user', uid, `Initial administrator account created (${email})`, email, 'admin');
        return getUserByUid(uid)!;
      });

      const token = signSessionToken({ uid: created.uid, role: created.role, email: created.email });
      setSessionCookie(req, res, token);
      res.status(201).json({ user: created, token });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to complete administrator setup.';
      res.status(status).json({ error: message });
    }
  });

  router.post('/auth/register-student', (req: Request, res: Response) => {
    try {
      const studentInput = validateStudentInput({
        studentId: req.body?.studentId,
        fullName: req.body?.fullName,
        email: req.body?.email,
        department: req.body?.department,
        semester: req.body?.semester,
        phone: req.body?.phone,
      });
      const password = String(req.body?.password ?? '');
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        return;
      }

      const created = runInTransaction(() => {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(studentInput.email);
        if (existingUser) {
          throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
        }
        const existingClaim = db.prepare('SELECT id FROM users WHERE studentId = ?').get(studentInput.studentId);
        if (existingClaim) {
          throw Object.assign(new Error('This Student ID is already linked to a registered account.'), { status: 409 });
        }

        const now = new Date().toISOString();
        const existingStudentById = db
          .prepare('SELECT studentId, email FROM students WHERE studentId = ?')
          .get(studentInput.studentId) as { studentId: string; email: string } | undefined;

        if (existingStudentById) {
          if (existingStudentById.email.toLowerCase() !== studentInput.email) {
            throw Object.assign(
              new Error('Student ID is already registered under a different email address.'),
              { status: 409 }
            );
          }
        } else {
          const existingStudentByEmail = db
            .prepare('SELECT studentId FROM students WHERE email = ?')
            .get(studentInput.email);
          if (existingStudentByEmail) {
            throw Object.assign(new Error('A student record with this email already exists under another ID.'), {
              status: 409,
            });
          }
          db.prepare(
            `INSERT INTO students (studentId, fullName, email, department, semester, phone, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            studentInput.studentId,
            studentInput.fullName,
            studentInput.email,
            studentInput.department,
            studentInput.semester,
            studentInput.phone,
            now,
            now
          );
        }

        const uid = `usr_${crypto.randomUUID()}`;
        const passwordHash = hashPassword(password);
        db.prepare(
          `INSERT INTO users (uid, name, email, passwordHash, role, studentId, createdAt)
           VALUES (?, ?, ?, ?, 'student', ?, ?)`
        ).run(uid, studentInput.fullName, studentInput.email, passwordHash, studentInput.studentId, now);

        logActivity(
          'STUDENT_REGISTER',
          'user',
          uid,
          `Student account registered (${studentInput.studentId})`,
          studentInput.email,
          'student'
        );
        return getUserByUid(uid)!;
      });

      const token = signSessionToken({ uid: created.uid, role: created.role, email: created.email });
      setSessionCookie(req, res, token);
      res.status(201).json({ user: created, token });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to register student account.';
      res.status(status).json({ error: message });
    }
  });

  router.post('/auth/login', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, uid, name, email, passwordHash, role, studentId, createdAt FROM users WHERE email = ?')
      .get(email) as (User & { passwordHash: string }) | undefined;

    if (!row || !verifyPassword(password, row.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user: User = {
      id: row.id,
      uid: row.uid,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      studentId: row.studentId,
      createdAt: row.createdAt,
    };

    const token = signSessionToken({ uid: user.uid, role: user.role, email: user.email });
    setSessionCookie(req, res, token);
    res.json({ user, token });
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // --- DASHBOARD ---
  router.get('/dashboard/stats', requireAuth, (req: AuthedRequest, res: Response) => {
    syncOverdueStatuses();
    const user = req.user!;
    const today = getTodayIsoDate();
    const soonThreshold = addDaysToIsoDate(today, 3);

    const bookSummary = db
      .prepare(
        `SELECT COUNT(*) as totalBooks,
                COALESCE(SUM(totalCopies), 0) as totalCopies,
                COALESCE(SUM(availableCopies), 0) as totalAvailableCopies
         FROM books`
      )
      .get() as { totalBooks: number; totalCopies: number; totalAvailableCopies: number };

    const studentFilter = user.role === 'student' ? 'WHERE studentId = ?' : '';
    const studentArgs = user.role === 'student' ? [user.studentId ?? '__NONE__'] : [];

    const borrowedRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM borrowRecords ${
          studentFilter ? `${studentFilter} AND` : 'WHERE'
        } status IN ('Borrowed', 'Overdue')`
      )
      .get(...studentArgs) as { cnt: number };

    const overdueRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM borrowRecords ${
          studentFilter ? `${studentFilter} AND` : 'WHERE'
        } status = 'Overdue'`
      )
      .get(...studentArgs) as { cnt: number };

    const totalBorrowRow = db
      .prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(fineAmount), 0) as totalFines FROM borrowRecords ${studentFilter}`)
      .get(...studentArgs) as { cnt: number; totalFines: number };

    const totalStudentsRow =
      user.role === 'admin'
        ? (db.prepare('SELECT COUNT(*) as cnt FROM students').get() as { cnt: number })
        : { cnt: 1 };

    const categoryDistribution = db
      .prepare(
        `SELECT category,
                COUNT(*) as books,
                COALESCE(SUM(totalCopies), 0) as copies,
                COALESCE(SUM(availableCopies), 0) as available
         FROM books
         GROUP BY category
         ORDER BY books DESC, category ASC`
      )
      .all() as Array<{ category: string; books: number; copies: number; available: number }>;

    // Monthly activity across last 6 months (computed from real borrowRecords)
    const monthlyRows = db
      .prepare(
        `SELECT substr(issueDate, 1, 7) as month, COUNT(*) as issued
         FROM borrowRecords
         ${studentFilter}
         GROUP BY substr(issueDate, 1, 7)
         ORDER BY month DESC
         LIMIT 6`
      )
      .all(...studentArgs) as Array<{ month: string; issued: number }>;

    const returnedMonthlyRows = db
      .prepare(
        `SELECT substr(returnDate, 1, 7) as month, COUNT(*) as returned
         FROM borrowRecords
         ${studentFilter ? `${studentFilter} AND` : 'WHERE'} returnDate IS NOT NULL
         GROUP BY substr(returnDate, 1, 7)
         ORDER BY month DESC
         LIMIT 6`
      )
      .all(...studentArgs) as Array<{ month: string; returned: number }>;

    const monthMap = new Map<string, { month: string; issued: number; returned: number }>();
    for (const r of monthlyRows) {
      monthMap.set(r.month, { month: r.month, issued: r.issued, returned: 0 });
    }
    for (const r of returnedMonthlyRows) {
      const existing = monthMap.get(r.month) ?? { month: r.month, issued: 0, returned: 0 };
      existing.returned = r.returned;
      monthMap.set(r.month, existing);
    }
    const monthlyActivity = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const popularBooks = db
      .prepare(
        `SELECT b.bookId, b.title, b.author, b.availableCopies, b.totalCopies,
                COUNT(br.id) as borrowCount
         FROM books b
         LEFT JOIN borrowRecords br ON b.bookId = br.bookId
         GROUP BY b.bookId
         ORDER BY borrowCount DESC, b.title ASC
         LIMIT 5`
      )
      .all() as Array<{
      bookId: string;
      title: string;
      author: string;
      borrowCount: number;
      availableCopies: number;
      totalCopies: number;
    }>;

    const nearingDue = db
      .prepare(
        `SELECT * FROM borrowRecords
         ${studentFilter ? `${studentFilter} AND` : 'WHERE'} status IN ('Borrowed', 'Overdue')
         AND dueDate <= ?
         ORDER BY dueDate ASC
         LIMIT 8`
      )
      .all(...studentArgs, soonThreshold);

    const recentActivity =
      user.role === 'admin'
        ? db.prepare('SELECT * FROM activityLogs ORDER BY id DESC LIMIT 10').all()
        : db
            .prepare('SELECT * FROM activityLogs WHERE performedBy = ? ORDER BY id DESC LIMIT 10')
            .all(user.email);

    res.json({
      totalBooks: bookSummary.totalBooks,
      totalCopies: bookSummary.totalCopies,
      totalAvailableCopies: bookSummary.totalAvailableCopies,
      currentlyBorrowed: borrowedRow.cnt,
      overdueBooks: overdueRow.cnt,
      totalStudents: totalStudentsRow.cnt,
      totalBorrowRecords: totalBorrowRow.cnt,
      totalFinesCollected: Number(totalBorrowRow.totalFines.toFixed(2)),
      categoryDistribution,
      monthlyActivity,
      popularBooks,
      nearingDue,
      recentActivity,
    });
  });

  // --- BOOKS ---
  router.get('/books', requireAuth, (req: AuthedRequest, res: Response) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const category = String(req.query.category ?? '').trim();
    const sortBy = String(req.query.sortBy ?? 'title');
    const sortOrder = String(req.query.sortOrder ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const allowedSort: Record<string, string> = {
      title: 'b.title',
      author: 'b.author',
      bookId: 'b.bookId',
      publicationYear: 'b.publicationYear',
      availableCopies: 'b.availableCopies',
      totalCopies: 'b.totalCopies',
      createdAt: 'b.createdAt',
    };
    const orderCol = allowedSort[sortBy] ?? 'b.title';

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      whereClauses.push(
        '(LOWER(b.title) LIKE ? OR LOWER(b.author) LIKE ? OR LOWER(b.isbn) LIKE ? OR LOWER(b.bookId) LIKE ?)'
      );
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    if (category && category !== 'All') {
      whereClauses.push('b.category = ?');
      params.push(category);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT b.*,
                (SELECT COUNT(*) FROM borrowRecords br WHERE br.bookId = b.bookId AND br.status IN ('Borrowed', 'Overdue')) as activeBorrowCount
         FROM books b
         ${whereSql}
         ORDER BY ${orderCol} ${sortOrder}`
      )
      .all(...params);

    res.json({ books: rows });
  });

  router.get('/books/:bookId', requireAuth, (req: AuthedRequest, res: Response) => {
    syncOverdueStatuses();
    const book = db.prepare('SELECT * FROM books WHERE bookId = ?').get(req.params.bookId);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    const activeBorrows =
      req.user!.role === 'admin'
        ? db
            .prepare(
              "SELECT * FROM borrowRecords WHERE bookId = ? AND status IN ('Borrowed', 'Overdue') ORDER BY dueDate ASC"
            )
            .all(req.params.bookId)
        : [];
    res.json({ book, activeBorrows });
  });

  router.post('/books', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const valid = validateBookInput(req.body);
      const now = new Date().toISOString();

      const book = runInTransaction(() => {
        const dupId = db.prepare('SELECT id FROM books WHERE bookId = ?').get(valid.bookId);
        if (dupId) {
          throw Object.assign(new Error(`Book ID "${valid.bookId}" already exists.`), { status: 409 });
        }
        const dupIsbn = db.prepare('SELECT id FROM books WHERE isbn = ?').get(valid.isbn);
        if (dupIsbn) {
          throw Object.assign(new Error(`ISBN "${valid.isbn}" is already cataloged.`), { status: 409 });
        }

        db.prepare(
          `INSERT INTO books (bookId, isbn, title, author, category, publisher, publicationYear, totalCopies, availableCopies, description, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          valid.bookId,
          valid.isbn,
          valid.title,
          valid.author,
          valid.category,
          valid.publisher,
          valid.publicationYear,
          valid.totalCopies,
          valid.availableCopies,
          valid.description,
          now,
          now
        );

        logActivity('ADD_BOOK', 'book', valid.bookId, `Added "${valid.title}" (${valid.totalCopies} copies)`, req.user!.email, 'admin');
        return db.prepare('SELECT * FROM books WHERE bookId = ?').get(valid.bookId);
      });

      res.status(201).json({ book });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to add book.';
      res.status(status).json({ error: message });
    }
  });

  router.put('/books/:bookId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.bookId).trim().toUpperCase();
      const valid = validateBookInput({ ...req.body, bookId: targetId });
      const now = new Date().toISOString();

      const updated = runInTransaction(() => {
        const existing = db.prepare('SELECT * FROM books WHERE bookId = ?').get(targetId);
        if (!existing) {
          throw Object.assign(new Error(`Book "${targetId}" not found.`), { status: 404 });
        }

        const dupIsbn = db.prepare('SELECT id FROM books WHERE isbn = ? AND bookId != ?').get(valid.isbn, targetId);
        if (dupIsbn) {
          throw Object.assign(new Error(`ISBN "${valid.isbn}" belongs to another book.`), { status: 409 });
        }

        const activeRow = db
          .prepare("SELECT COUNT(*) as cnt FROM borrowRecords WHERE bookId = ? AND status IN ('Borrowed', 'Overdue')")
          .get(targetId) as { cnt: number };

        if (valid.totalCopies < activeRow.cnt) {
          throw Object.assign(
            new Error(
              `Total copies (${valid.totalCopies}) cannot be less than currently borrowed copies (${activeRow.cnt}).`
            ),
            { status: 400 }
          );
        }

        if (valid.availableCopies > valid.totalCopies - activeRow.cnt) {
          throw Object.assign(
            new Error(
              `Available copies cannot exceed ${valid.totalCopies - activeRow.cnt} (${activeRow.cnt} currently borrowed).`
            ),
            { status: 400 }
          );
        }

        db.prepare(
          `UPDATE books
           SET isbn = ?, title = ?, author = ?, category = ?, publisher = ?, publicationYear = ?,
               totalCopies = ?, availableCopies = ?, description = ?, updatedAt = ?
           WHERE bookId = ?`
        ).run(
          valid.isbn,
          valid.title,
          valid.author,
          valid.category,
          valid.publisher,
          valid.publicationYear,
          valid.totalCopies,
          valid.availableCopies,
          valid.description,
          now,
          targetId
        );

        logActivity('EDIT_BOOK', 'book', targetId, `Updated "${valid.title}"`, req.user!.email, 'admin');
        return db.prepare('SELECT * FROM books WHERE bookId = ?').get(targetId);
      });

      res.json({ book: updated });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to update book.';
      res.status(status).json({ error: message });
    }
  });

  router.delete('/books/:bookId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.bookId).trim().toUpperCase();
      runInTransaction(() => {
        const existing = db.prepare('SELECT * FROM books WHERE bookId = ?').get(targetId) as { title: string } | undefined;
        if (!existing) {
          throw Object.assign(new Error(`Book "${targetId}" not found.`), { status: 404 });
        }
        const activeRow = db
          .prepare("SELECT COUNT(*) as cnt FROM borrowRecords WHERE bookId = ? AND status IN ('Borrowed', 'Overdue')")
          .get(targetId) as { cnt: number };

        if (activeRow.cnt > 0) {
          throw Object.assign(
            new Error(
              `Cannot delete "${existing.title}" because ${activeRow.cnt} active borrowing record(s) exist. Return all borrowed copies first.`
            ),
            { status: 409 }
          );
        }

        db.prepare('DELETE FROM books WHERE bookId = ?').run(targetId);
        logActivity('DELETE_BOOK', 'book', targetId, `Deleted book "${existing.title}"`, req.user!.email, 'admin');
      });

      res.json({ success: true });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to delete book.';
      res.status(status).json({ error: message });
    }
  });

  // --- STUDENTS ---
  router.get('/students', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const department = String(req.query.department ?? '').trim();

    const whereClauses: string[] = [];
    const params: string[] = [];
    if (search) {
      whereClauses.push(
        '(LOWER(s.studentId) LIKE ? OR LOWER(s.fullName) LIKE ? OR LOWER(s.email) LIKE ? OR LOWER(s.department) LIKE ?)'
      );
      const p = `%${search}%`;
      params.push(p, p, p, p);
    }
    if (department && department !== 'All') {
      whereClauses.push('s.department = ?');
      params.push(department);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM borrowRecords br WHERE br.studentId = s.studentId AND br.status IN ('Borrowed', 'Overdue')) as activeBorrowCount,
                (SELECT COUNT(*) FROM borrowRecords br WHERE br.studentId = s.studentId) as totalBorrowCount
         FROM students s
         ${whereSql}
         ORDER BY s.studentId ASC`
      )
      .all(...params);

    res.json({ students: rows });
  });

  router.get('/students/:studentId', requireAuth, (req: AuthedRequest, res: Response) => {
    syncOverdueStatuses();
    const targetId = String(req.params.studentId).trim().toUpperCase();
    if (req.user!.role !== 'admin' && req.user!.studentId !== targetId) {
      res.status(403).json({ error: 'You are only authorized to view your own student profile.' });
      return;
    }

    const student = db.prepare('SELECT * FROM students WHERE studentId = ?').get(targetId);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const history = db
      .prepare('SELECT * FROM borrowRecords WHERE studentId = ? ORDER BY issueDate DESC, id DESC')
      .all(targetId);
    res.json({ student, history });
  });

  router.post('/students', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const valid = validateStudentInput(req.body);
      const portalPassword = req.body?.portalPassword ? String(req.body.portalPassword) : '';
      const now = new Date().toISOString();

      const student = runInTransaction(() => {
        const dupId = db.prepare('SELECT id FROM students WHERE studentId = ?').get(valid.studentId);
        if (dupId) {
          throw Object.assign(new Error(`Student ID "${valid.studentId}" already exists.`), { status: 409 });
        }
        const dupEmail = db.prepare('SELECT id FROM students WHERE email = ?').get(valid.email);
        if (dupEmail) {
          throw Object.assign(new Error(`Email "${valid.email}" is already registered to another student.`), {
            status: 409,
          });
        }

        db.prepare(
          `INSERT INTO students (studentId, fullName, email, department, semester, phone, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          valid.studentId,
          valid.fullName,
          valid.email,
          valid.department,
          valid.semester,
          valid.phone,
          now,
          now
        );

        if (portalPassword) {
          const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(valid.email);
          if (existingUser) {
            throw Object.assign(new Error('A login account with this email already exists.'), { status: 409 });
          }
          const uid = `usr_${crypto.randomUUID()}`;
          db.prepare(
            `INSERT INTO users (uid, name, email, passwordHash, role, studentId, createdAt)
             VALUES (?, ?, ?, ?, 'student', ?, ?)`
          ).run(uid, valid.fullName, valid.email, hashPassword(portalPassword), valid.studentId, now);
        }

        logActivity(
          'ADD_STUDENT',
          'student',
          valid.studentId,
          `Registered student ${valid.fullName} (${valid.department})`,
          req.user!.email,
          'admin'
        );
        return db.prepare('SELECT * FROM students WHERE studentId = ?').get(valid.studentId);
      });

      res.status(201).json({ student });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to add student.';
      res.status(status).json({ error: message });
    }
  });

  router.put('/students/:studentId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.studentId).trim().toUpperCase();
      const valid = validateStudentInput({ ...req.body, studentId: targetId });
      const now = new Date().toISOString();

      const updated = runInTransaction(() => {
        const existing = db.prepare('SELECT * FROM students WHERE studentId = ?').get(targetId);
        if (!existing) {
          throw Object.assign(new Error(`Student "${targetId}" not found.`), { status: 404 });
        }
        const dupEmail = db
          .prepare('SELECT id FROM students WHERE email = ? AND studentId != ?')
          .get(valid.email, targetId);
        if (dupEmail) {
          throw Object.assign(new Error(`Email "${valid.email}" is already used by another student.`), {
            status: 409,
          });
        }

        db.prepare(
          `UPDATE students
           SET fullName = ?, email = ?, department = ?, semester = ?, phone = ?, updatedAt = ?
           WHERE studentId = ?`
        ).run(valid.fullName, valid.email, valid.department, valid.semester, valid.phone, now, targetId);

        db.prepare('UPDATE users SET name = ?, email = ? WHERE studentId = ?').run(
          valid.fullName,
          valid.email,
          targetId
        );

        logActivity('EDIT_STUDENT', 'student', targetId, `Updated student ${valid.fullName}`, req.user!.email, 'admin');
        return db.prepare('SELECT * FROM students WHERE studentId = ?').get(targetId);
      });

      res.json({ student: updated });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to update student.';
      res.status(status).json({ error: message });
    }
  });

  router.delete('/students/:studentId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.studentId).trim().toUpperCase();
      runInTransaction(() => {
        const existing = db.prepare('SELECT * FROM students WHERE studentId = ?').get(targetId) as
          | { fullName: string }
          | undefined;
        if (!existing) {
          throw Object.assign(new Error(`Student "${targetId}" not found.`), { status: 404 });
        }

        const activeRow = db
          .prepare("SELECT COUNT(*) as cnt FROM borrowRecords WHERE studentId = ? AND status IN ('Borrowed', 'Overdue')")
          .get(targetId) as { cnt: number };

        if (activeRow.cnt > 0) {
          throw Object.assign(
            new Error(
              `Cannot delete ${existing.fullName} because they currently have ${activeRow.cnt} unreturned book(s).`
            ),
            { status: 409 }
          );
        }

        db.prepare('DELETE FROM users WHERE studentId = ?').run(targetId);
        db.prepare('DELETE FROM students WHERE studentId = ?').run(targetId);
        logActivity('DELETE_STUDENT', 'student', targetId, `Deleted student ${existing.fullName}`, req.user!.email, 'admin');
      });

      res.json({ success: true });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to delete student.';
      res.status(status).json({ error: message });
    }
  });

  // --- ISSUE & RETURN BOOKS ---
  router.post('/borrow/issue', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      syncOverdueStatuses();
      const studentId = String(req.body?.studentId ?? '').trim().toUpperCase();
      const bookId = String(req.body?.bookId ?? '').trim().toUpperCase();
      const issueDate = String(req.body?.issueDate ?? getTodayIsoDate()).trim();
      const customDuration = req.body?.borrowingDurationDays ? Number(req.body.borrowingDurationDays) : null;
      const notes = String(req.body?.notes ?? '').trim().slice(0, 400);

      if (!studentId || !bookId) {
        res.status(400).json({ error: 'Both Student ID and Book ID are required.' });
        return;
      }
      parseIsoDate(issueDate);

      const record = runInTransaction(() => {
        const settings = db.prepare("SELECT * FROM settings WHERE id = 'default'").get() as {
          borrowingDurationDays: number;
          maxBorrowingLimit: number;
          preventDuplicateActiveIssue: number;
        };

        const durationDays = customDuration ?? settings.borrowingDurationDays;
        if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
          throw Object.assign(new Error('Borrowing duration must be between 1 and 365 days.'), { status: 400 });
        }

        const student = db.prepare('SELECT * FROM students WHERE studentId = ?').get(studentId) as
          | { studentId: string; fullName: string }
          | undefined;
        if (!student) {
          throw Object.assign(new Error(`Invalid student: "${studentId}" does not exist.`), { status: 404 });
        }

        const book = db.prepare('SELECT * FROM books WHERE bookId = ?').get(bookId) as
          | { bookId: string; title: string; isbn: string; availableCopies: number }
          | undefined;
        if (!book) {
          throw Object.assign(new Error(`Invalid book: "${bookId}" does not exist.`), { status: 404 });
        }
        if (book.availableCopies <= 0) {
          throw Object.assign(new Error(`"${book.title}" currently has 0 available copies.`), { status: 409 });
        }

        const activeCountRow = db
          .prepare("SELECT COUNT(*) as cnt FROM borrowRecords WHERE studentId = ? AND status IN ('Borrowed', 'Overdue')")
          .get(studentId) as { cnt: number };

        if (activeCountRow.cnt >= settings.maxBorrowingLimit) {
          throw Object.assign(
            new Error(
              `Borrowing limit reached: ${student.fullName} already has ${activeCountRow.cnt} active books (max ${settings.maxBorrowingLimit}).`
            ),
            { status: 409 }
          );
        }

        if (settings.preventDuplicateActiveIssue === 1) {
          const dupActive = db
            .prepare(
              "SELECT recordId FROM borrowRecords WHERE studentId = ? AND bookId = ? AND status IN ('Borrowed', 'Overdue')"
            )
            .get(studentId, bookId) as { recordId: string } | undefined;
          if (dupActive) {
            throw Object.assign(
              new Error(
                `${student.fullName} already has an active borrowing record (${dupActive.recordId}) for "${book.title}".`
              ),
              { status: 409 }
            );
          }
        }

        // Atomic decrement guarded against negative copies
        const decResult = db
          .prepare('UPDATE books SET availableCopies = availableCopies - 1, updatedAt = ? WHERE bookId = ? AND availableCopies > 0')
          .run(new Date().toISOString(), bookId);

        if (Number(decResult.changes) !== 1) {
          throw Object.assign(new Error('Book availability changed concurrently; no copies available.'), { status: 409 });
        }

        const dueDate = addDaysToIsoDate(issueDate, durationDays);
        const today = getTodayIsoDate();
        const status = dueDate < today ? 'Overdue' : 'Borrowed';
        const recordId = `BR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO borrowRecords (recordId, studentId, studentName, bookId, bookTitle, isbn, issueDate, dueDate, returnDate, status, overdueDays, fineAmount, issuedBy, returnedBy, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 0, ?, NULL, ?, ?, ?)`
        ).run(
          recordId,
          student.studentId,
          student.fullName,
          book.bookId,
          book.title,
          book.isbn,
          issueDate,
          dueDate,
          status,
          req.user!.email,
          notes,
          now,
          now
        );

        logActivity(
          'ISSUE_BOOK',
          'borrowRecord',
          recordId,
          `Issued "${book.title}" to ${student.fullName} (Due ${dueDate})`,
          req.user!.email,
          'admin'
        );

        return db.prepare('SELECT * FROM borrowRecords WHERE recordId = ?').get(recordId);
      });

      res.status(201).json({ record });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to issue book.';
      res.status(status).json({ error: message });
    }
  });

  router.post('/borrow/preview-return', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const recordId = String(req.body?.recordId ?? '').trim();
      const returnDate = String(req.body?.returnDate ?? getTodayIsoDate()).trim();
      if (!recordId) {
        res.status(400).json({ error: 'Borrow record ID is required.' });
        return;
      }

      const record = db.prepare('SELECT * FROM borrowRecords WHERE recordId = ?').get(recordId) as
        | {
            recordId: string;
            bookId: string;
            bookTitle: string;
            studentId: string;
            studentName: string;
            issueDate: string;
            dueDate: string;
            status: string;
          }
        | undefined;

      if (!record) {
        res.status(404).json({ error: 'Borrowing record not found.' });
        return;
      }
      if (record.status === 'Returned') {
        res.status(409).json({ error: 'This book has already been returned.' });
        return;
      }

      validateReturnChronology(record.issueDate, returnDate);
      const settings = db.prepare("SELECT finePerOverdueDay, currencySymbol FROM settings WHERE id = 'default'").get() as {
        finePerOverdueDay: number;
        currencySymbol: string;
      };
      const { overdueDays, fineAmount } = calculateFine(record.dueDate, returnDate, settings.finePerOverdueDay);

      res.json({
        preview: {
          recordId: record.recordId,
          bookId: record.bookId,
          bookTitle: record.bookTitle,
          studentId: record.studentId,
          studentName: record.studentName,
          issueDate: record.issueDate,
          dueDate: record.dueDate,
          returnDate,
          overdueDays,
          finePerOverdueDay: settings.finePerOverdueDay,
          fineAmount,
          currencySymbol: settings.currencySymbol,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid return preview request.';
      res.status(400).json({ error: message });
    }
  });

  router.post('/borrow/return', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const recordId = String(req.body?.recordId ?? '').trim();
      const returnDate = String(req.body?.returnDate ?? getTodayIsoDate()).trim();
      const notes = String(req.body?.notes ?? '').trim().slice(0, 400);

      if (!recordId) {
        res.status(400).json({ error: 'Borrow record ID is required.' });
        return;
      }

      const updatedRecord = runInTransaction(() => {
        const record = db.prepare('SELECT * FROM borrowRecords WHERE recordId = ?').get(recordId) as
          | {
              recordId: string;
              bookId: string;
              bookTitle: string;
              studentId: string;
              studentName: string;
              issueDate: string;
              dueDate: string;
              returnDate: string | null;
              status: string;
              notes: string;
            }
          | undefined;

        if (!record) {
          throw Object.assign(new Error(`Borrowing record "${recordId}" not found.`), { status: 404 });
        }
        if (record.status === 'Returned' || record.returnDate !== null) {
          throw Object.assign(
            new Error(`Duplicate return blocked: Record "${recordId}" was already returned on ${record.returnDate}.`),
            { status: 409 }
          );
        }

        validateReturnChronology(record.issueDate, returnDate);
        const settings = db
          .prepare("SELECT finePerOverdueDay, currencySymbol FROM settings WHERE id = 'default'")
          .get() as { finePerOverdueDay: number; currencySymbol: string };

        const { overdueDays, fineAmount } = calculateFine(record.dueDate, returnDate, settings.finePerOverdueDay);
        const now = new Date().toISOString();
        const mergedNotes = notes || record.notes;

        const retRes = db
          .prepare(
            `UPDATE borrowRecords
             SET returnDate = ?, status = 'Returned', overdueDays = ?, fineAmount = ?, returnedBy = ?, notes = ?, updatedAt = ?
             WHERE recordId = ? AND status != 'Returned' AND returnDate IS NULL`
          )
          .run(returnDate, overdueDays, fineAmount, req.user!.email, mergedNotes, now, recordId);

        if (Number(retRes.changes) !== 1) {
          throw Object.assign(new Error('Return conflicted with another concurrent operation.'), { status: 409 });
        }

        // Safely increment availableCopies without exceeding totalCopies
        db.prepare(
          `UPDATE books
           SET availableCopies = MIN(totalCopies, availableCopies + 1), updatedAt = ?
           WHERE bookId = ?`
        ).run(now, record.bookId);

        logActivity(
          'RETURN_BOOK',
          'borrowRecord',
          recordId,
          `Returned "${record.bookTitle}" from ${record.studentName} (${overdueDays} overdue days, fine ${settings.currencySymbol}${fineAmount})`,
          req.user!.email,
          'admin'
        );

        return db.prepare('SELECT * FROM borrowRecords WHERE recordId = ?').get(recordId);
      });

      res.json({ record: updatedRecord });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status ?? 400;
      const message = err instanceof Error ? err.message : 'Unable to process book return.';
      res.status(status).json({ error: message });
    }
  });

  router.get('/borrow/records', requireAuth, (req: AuthedRequest, res: Response) => {
    syncOverdueStatuses();
    const user = req.user!;
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const statusFilter = String(req.query.status ?? 'All').trim();
    const sortBy = String(req.query.sortBy ?? 'issueDate');
    const sortOrder = String(req.query.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));

    const allowedSort: Record<string, string> = {
      issueDate: 'issueDate',
      dueDate: 'dueDate',
      returnDate: 'returnDate',
      studentName: 'studentName',
      bookTitle: 'bookTitle',
      status: 'status',
      fineAmount: 'fineAmount',
      overdueDays: 'overdueDays',
    };
    const orderCol = allowedSort[sortBy] ?? 'issueDate';

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (user.role === 'student') {
      whereClauses.push('studentId = ?');
      params.push(user.studentId ?? '__NONE__');
    }

    if (statusFilter === 'Active') {
      whereClauses.push("status IN ('Borrowed', 'Overdue')");
    } else if (statusFilter && statusFilter !== 'All') {
      whereClauses.push('status = ?');
      params.push(statusFilter);
    }

    if (search) {
      whereClauses.push(
        '(LOWER(recordId) LIKE ? OR LOWER(studentId) LIKE ? OR LOWER(studentName) LIKE ? OR LOWER(bookId) LIKE ? OR LOWER(bookTitle) LIKE ? OR LOWER(isbn) LIKE ?)'
      );
      const p = `%${search}%`;
      params.push(p, p, p, p, p, p);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const totalRow = db
      .prepare(`SELECT COUNT(*) as total FROM borrowRecords ${whereSql}`)
      .get(...params) as { total: number };

    const offset = (page - 1) * pageSize;
    const records = db
      .prepare(
        `SELECT * FROM borrowRecords
         ${whereSql}
         ORDER BY ${orderCol} ${sortOrder}, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset);

    res.json({
      records,
      total: totalRow.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalRow.total / pageSize)),
    });
  });

  // --- TESTING DASHBOARD: TEST CASES ---
  router.get('/test-cases', requireAuth, (_req, res: Response) => {
    const testCases = db.prepare('SELECT * FROM testCases ORDER BY testCaseId ASC').all();
    res.json({ testCases });
  });

  router.post('/test-cases', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const testCaseId = String(req.body?.testCaseId ?? '').trim().toUpperCase();
      const moduleName = String(req.body?.module ?? '').trim();
      const technique = String(req.body?.technique ?? 'Manual Testing').trim();
      const testScenario = String(req.body?.testScenario ?? '').trim();
      const testInput = String(req.body?.testInput ?? '').trim();
      const expectedResult = String(req.body?.expectedResult ?? '').trim();
      const actualResult = String(req.body?.actualResult ?? '').trim();
      const status = String(req.body?.status ?? 'Not Executed').trim();
      const defectId = req.body?.defectId ? String(req.body.defectId).trim().toUpperCase() : null;

      if (!testCaseId || !moduleName || !testScenario || !expectedResult) {
        res.status(400).json({ error: 'Test Case ID, Module, Scenario, and Expected Result are required.' });
        return;
      }

      const dup = db.prepare('SELECT id FROM testCases WHERE testCaseId = ?').get(testCaseId);
      if (dup) {
        res.status(409).json({ error: `Test Case ID "${testCaseId}" already exists.` });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO testCases (testCaseId, module, technique, testScenario, testInput, expectedResult, actualResult, status, defectId, executedBy, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        testCaseId,
        moduleName,
        technique,
        testScenario,
        testInput,
        expectedResult,
        actualResult,
        status,
        defectId,
        status === 'Not Executed' ? '' : req.user!.email,
        now
      );

      logActivity('ADD_TEST_CASE', 'testCase', testCaseId, `Added test case ${testCaseId} (${status})`, req.user!.email, 'admin');
      const created = db.prepare('SELECT * FROM testCases WHERE testCaseId = ?').get(testCaseId);
      res.status(201).json({ testCase: created });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to save test case.' });
    }
  });

  router.put('/test-cases/:testCaseId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.testCaseId).trim().toUpperCase();
      const existing = db.prepare('SELECT * FROM testCases WHERE testCaseId = ?').get(targetId);
      if (!existing) {
        res.status(404).json({ error: `Test case "${targetId}" not found.` });
        return;
      }

      const moduleName = String(req.body?.module ?? '').trim();
      const technique = String(req.body?.technique ?? 'Manual Testing').trim();
      const testScenario = String(req.body?.testScenario ?? '').trim();
      const testInput = String(req.body?.testInput ?? '').trim();
      const expectedResult = String(req.body?.expectedResult ?? '').trim();
      const actualResult = String(req.body?.actualResult ?? '').trim();
      const status = String(req.body?.status ?? 'Not Executed').trim();
      const defectId = req.body?.defectId ? String(req.body.defectId).trim().toUpperCase() : null;

      if (!moduleName || !testScenario || !expectedResult) {
        res.status(400).json({ error: 'Module, Scenario, and Expected Result are required.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE testCases
         SET module = ?, technique = ?, testScenario = ?, testInput = ?, expectedResult = ?,
             actualResult = ?, status = ?, defectId = ?, executedBy = ?, updatedAt = ?
         WHERE testCaseId = ?`
      ).run(
        moduleName,
        technique,
        testScenario,
        testInput,
        expectedResult,
        actualResult,
        status,
        defectId,
        status === 'Not Executed' ? '' : req.user!.email,
        now,
        targetId
      );

      logActivity('EXECUTE_TEST_CASE', 'testCase', targetId, `Recorded ${targetId} as ${status}`, req.user!.email, 'admin');
      const updated = db.prepare('SELECT * FROM testCases WHERE testCaseId = ?').get(targetId);
      res.json({ testCase: updated });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update test case.' });
    }
  });

  router.delete('/test-cases/:testCaseId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const targetId = String(req.params.testCaseId).trim().toUpperCase();
    const resDel = db.prepare('DELETE FROM testCases WHERE testCaseId = ?').run(targetId);
    if (Number(resDel.changes) === 0) {
      res.status(404).json({ error: 'Test case not found.' });
      return;
    }
    res.json({ success: true });
  });

  // --- TESTING DASHBOARD: DEFECTS ---
  router.get('/defects', requireAuth, (_req, res: Response) => {
    const defects = db.prepare('SELECT * FROM defects ORDER BY dateReported DESC, defectId ASC').all();
    res.json({ defects });
  });

  router.post('/defects', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const defectId = String(req.body?.defectId ?? '').trim().toUpperCase();
      const title = String(req.body?.title ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const stepsToReproduce = String(req.body?.stepsToReproduce ?? '').trim();
      const expectedResult = String(req.body?.expectedResult ?? '').trim();
      const actualResult = String(req.body?.actualResult ?? '').trim();
      const severity = String(req.body?.severity ?? 'Major').trim();
      const priority = String(req.body?.priority ?? 'P2 - High').trim();
      const status = String(req.body?.status ?? 'New').trim();
      const relatedTestCase = String(req.body?.relatedTestCase ?? '').trim().toUpperCase();
      const dateReported = String(req.body?.dateReported ?? getTodayIsoDate()).trim();

      if (!defectId || !title || !stepsToReproduce || !expectedResult || !actualResult) {
        res.status(400).json({ error: 'Defect ID, Title, Steps to Reproduce, Expected Result, and Actual Result are required.' });
        return;
      }

      const dup = db.prepare('SELECT id FROM defects WHERE defectId = ?').get(defectId);
      if (dup) {
        res.status(409).json({ error: `Defect ID "${defectId}" already exists.` });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO defects (defectId, title, description, stepsToReproduce, expectedResult, actualResult, severity, priority, status, relatedTestCase, dateReported, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        defectId,
        title,
        description,
        stepsToReproduce,
        expectedResult,
        actualResult,
        severity,
        priority,
        status,
        relatedTestCase,
        dateReported,
        now
      );

      logActivity('LOG_DEFECT', 'defect', defectId, `Logged defect ${defectId}: ${title}`, req.user!.email, 'admin');
      const created = db.prepare('SELECT * FROM defects WHERE defectId = ?').get(defectId);
      res.status(201).json({ defect: created });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to log defect.' });
    }
  });

  router.put('/defects/:defectId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    try {
      const targetId = String(req.params.defectId).trim().toUpperCase();
      const existing = db.prepare('SELECT * FROM defects WHERE defectId = ?').get(targetId);
      if (!existing) {
        res.status(404).json({ error: `Defect "${targetId}" not found.` });
        return;
      }

      const title = String(req.body?.title ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const stepsToReproduce = String(req.body?.stepsToReproduce ?? '').trim();
      const expectedResult = String(req.body?.expectedResult ?? '').trim();
      const actualResult = String(req.body?.actualResult ?? '').trim();
      const severity = String(req.body?.severity ?? 'Major').trim();
      const priority = String(req.body?.priority ?? 'P2 - High').trim();
      const status = String(req.body?.status ?? 'New').trim();
      const relatedTestCase = String(req.body?.relatedTestCase ?? '').trim().toUpperCase();

      if (!title || !stepsToReproduce || !expectedResult || !actualResult) {
        res.status(400).json({ error: 'Title, Steps, Expected Result, and Actual Result are required.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE defects
         SET title = ?, description = ?, stepsToReproduce = ?, expectedResult = ?, actualResult = ?,
             severity = ?, priority = ?, status = ?, relatedTestCase = ?, updatedAt = ?
         WHERE defectId = ?`
      ).run(
        title,
        description,
        stepsToReproduce,
        expectedResult,
        actualResult,
        severity,
        priority,
        status,
        relatedTestCase,
        now,
        targetId
      );

      logActivity('UPDATE_DEFECT', 'defect', targetId, `Updated defect ${targetId} (${status})`, req.user!.email, 'admin');
      const updated = db.prepare('SELECT * FROM defects WHERE defectId = ?').get(targetId);
      res.json({ defect: updated });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update defect.' });
    }
  });

  router.delete('/defects/:defectId', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const targetId = String(req.params.defectId).trim().toUpperCase();
    const resDel = db.prepare('DELETE FROM defects WHERE defectId = ?').run(targetId);
    if (Number(resDel.changes) === 0) {
      res.status(404).json({ error: 'Defect not found.' });
      return;
    }
    res.json({ success: true });
  });

  // --- SETTINGS & OPTIONAL SEED ---
  router.get('/settings', requireAuth, (_req, res: Response) => {
    const row = db.prepare("SELECT * FROM settings WHERE id = 'default'").get() as Record<string, unknown>;
    res.json({
      settings: {
        ...row,
        preventDuplicateActiveIssue: Boolean(row.preventDuplicateActiveIssue),
      },
    });
  });

  router.put('/settings', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const libraryName = String(req.body?.libraryName ?? '').trim();
    const borrowingDurationDays = Number(req.body?.borrowingDurationDays);
    const maxBorrowingLimit = Number(req.body?.maxBorrowingLimit);
    const finePerOverdueDay = Number(req.body?.finePerOverdueDay);
    const currencySymbol = String(req.body?.currencySymbol ?? '₹').trim().slice(0, 4) || '₹';
    const preventDuplicateActiveIssue = req.body?.preventDuplicateActiveIssue ? 1 : 0;

    if (libraryName.length < 2 || libraryName.length > 120) {
      res.status(400).json({ error: 'Library name must be between 2 and 120 characters.' });
      return;
    }
    if (!Number.isInteger(borrowingDurationDays) || borrowingDurationDays < 1 || borrowingDurationDays > 365) {
      res.status(400).json({ error: 'Borrowing duration must be an integer between 1 and 365 days.' });
      return;
    }
    if (!Number.isInteger(maxBorrowingLimit) || maxBorrowingLimit < 1 || maxBorrowingLimit > 50) {
      res.status(400).json({ error: 'Max borrowing limit must be an integer between 1 and 50.' });
      return;
    }
    if (Number.isNaN(finePerOverdueDay) || finePerOverdueDay < 0 || finePerOverdueDay > 10000) {
      res.status(400).json({ error: 'Fine per overdue day must be a non-negative number.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE settings
       SET libraryName = ?, borrowingDurationDays = ?, maxBorrowingLimit = ?, finePerOverdueDay = ?,
           currencySymbol = ?, preventDuplicateActiveIssue = ?, updatedAt = ?
       WHERE id = 'default'`
    ).run(
      libraryName,
      borrowingDurationDays,
      maxBorrowingLimit,
      finePerOverdueDay,
      currencySymbol,
      preventDuplicateActiveIssue,
      now
    );

    logActivity(
      'UPDATE_SETTINGS',
      'settings',
      'default',
      `Updated rules: ${borrowingDurationDays}d loan, max ${maxBorrowingLimit} books, ${currencySymbol}${finePerOverdueDay}/day fine`,
      req.user!.email,
      'admin'
    );

    const row = db.prepare("SELECT * FROM settings WHERE id = 'default'").get() as Record<string, unknown>;
    res.json({
      settings: {
        ...row,
        preventDuplicateActiveIssue: Boolean(row.preventDuplicateActiveIssue),
      },
    });
  });

  router.post('/admin/seed', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const result = seedSampleData(req.user!.email);
    res.json({ success: true, ...result });
  });

  router.post('/admin/reset', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    resetNonAdminData(req.user!.email);
    res.json({ success: true });
  });

  return router;
}
