import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { booksApi } from '../lib/api';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import type { Book, BorrowRecord, User } from '../types';

interface BooksViewProps {
  user: User;
}

const DEFAULT_FORM = {
  bookId: '',
  isbn: '',
  title: '',
  author: '',
  category: 'Software Engineering',
  publisher: '',
  publicationYear: String(new Date().getFullYear()),
  totalCopies: '1',
  availableCopies: '1',
  description: '',
};

export function BooksView({ user }: BooksViewProps) {
  const { showToast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [detailBorrows, setDetailBorrows] = useState<BorrowRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await booksApi.list({ sortBy, sortOrder });
      setBooks(res.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch books.');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ['All', ...Array.from(set).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      const matchesCat = categoryFilter === 'All' || b.category === categoryFilter;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.bookId.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [books, search, categoryFilter]);

  const openAddModal = () => {
    setEditingBook(null);
    const nextNum = 1001 + books.length;
    setFormState({ ...DEFAULT_FORM, bookId: `BK-${nextNum}` });
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setFormState({
      bookId: book.bookId,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      category: book.category,
      publisher: book.publisher,
      publicationYear: String(book.publicationYear),
      totalCopies: String(book.totalCopies),
      availableCopies: String(book.availableCopies),
      description: book.description,
    });
    setFormError('');
    setFormOpen(true);
  };

  const openDetails = async (book: Book) => {
    setDetailBook(book);
    setDetailBorrows([]);
    setDetailLoading(true);
    try {
      const res = await booksApi.get(book.bookId);
      setDetailBook(res.book);
      setDetailBorrows(res.activeBorrows);
    } catch {
      // keep summary
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const total = Number(formState.totalCopies);
    const avail = Number(formState.availableCopies);
    if (!Number.isInteger(total) || total < 1) {
      setFormError('Total copies must be at least 1.');
      return;
    }
    if (!Number.isInteger(avail) || avail < 0 || avail > total) {
      setFormError('Available copies must be between 0 and total copies.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        bookId: formState.bookId.trim().toUpperCase(),
        isbn: formState.isbn.trim(),
        title: formState.title.trim(),
        author: formState.author.trim(),
        category: formState.category.trim(),
        publisher: formState.publisher.trim(),
        publicationYear: Number(formState.publicationYear),
        totalCopies: total,
        availableCopies: avail,
        description: formState.description.trim(),
      };

      if (editingBook) {
        await booksApi.update(editingBook.bookId, payload);
        showToast('success', 'Book updated', `"${payload.title}" has been updated.`);
      } else {
        await booksApi.create(payload);
        showToast('success', 'Book added', `"${payload.title}" added to catalog.`);
      }
      setFormOpen(false);
      await fetchBooks();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save book.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await booksApi.delete(deleteTarget.bookId);
      showToast('success', 'Book deleted', `"${deleteTarget.title}" removed from catalog.`);
      setDeleteTarget(null);
      await fetchBooks();
    } catch (err) {
      showToast('error', 'Delete blocked', err instanceof Error ? err.message : 'Unable to delete book.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-5">
      {/* Filter & Action Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              data-testid="book-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, ISBN, or Book ID..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort books by"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="title">Sort: Title</option>
              <option value="author">Sort: Author</option>
              <option value="bookId">Sort: Book ID</option>
              <option value="publicationYear">Sort: Year</option>
              <option value="availableCopies">Sort: Availability</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              aria-label="Toggle sort order"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              title={`Order: ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            data-testid="add-book-btn"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Book
          </button>
        )}
      </div>

      {/* Table Container */}
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
              onClick={fetchBooks}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900">No matching books</h3>
            <p className="mt-1 text-sm text-slate-500">
              {books.length === 0
                ? 'The catalog currently has no books.'
                : 'Try adjusting your search query or category filter.'}
            </p>
            {isAdmin && books.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Book
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="books-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Book ID</th>
                  <th className="py-3 px-4">Title &amp; Author</th>
                  <th className="py-3 px-4">ISBN</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Year</th>
                  <th className="py-3 px-4 text-right">Availability</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredBooks.map((book) => {
                  const isOut = book.availableCopies === 0;
                  return (
                    <tr key={book.bookId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                        {book.bookId}
                      </td>
                      <td className="py-3 px-4 min-w-[220px] max-w-sm">
                        <p className="font-medium text-slate-900 truncate">{book.title}</p>
                        <p className="text-xs text-slate-500 truncate">{book.author}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {book.isbn}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">{book.category}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        {book.publicationYear}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono tabular-nums text-xs font-semibold ${
                            isOut ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {book.availableCopies} / {book.totalCopies}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {isOut ? 'Unavailable' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(book)}
                            aria-label={`View details for ${book.title}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(book)}
                                aria-label={`Edit ${book.title}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(book)}
                                aria-label={`Delete ${book.title}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Book Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingBook ? `Edit Book · ${editingBook.bookId}` : 'Add New Book'}
        subtitle="All catalog updates are validated and persisted to the library database."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              data-testid="book-form-error"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-id" className="block text-xs font-medium text-slate-700 mb-1">
                Book ID
              </label>
              <input
                id="book-id"
                data-testid="book-id-input"
                type="text"
                required
                disabled={Boolean(editingBook)}
                value={formState.bookId}
                onChange={(e) => setFormState((s) => ({ ...s, bookId: e.target.value }))}
                placeholder="BK-1001"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="book-isbn" className="block text-xs font-medium text-slate-700 mb-1">
                ISBN (10 or 13 digits)
              </label>
              <input
                id="book-isbn"
                data-testid="book-isbn-input"
                type="text"
                required
                value={formState.isbn}
                onChange={(e) => setFormState((s) => ({ ...s, isbn: e.target.value }))}
                placeholder="9780132350884"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="book-title" className="block text-xs font-medium text-slate-700 mb-1">
              Book Title
            </label>
            <input
              id="book-title"
              data-testid="book-title-input"
              type="text"
              required
              value={formState.title}
              onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
              placeholder="e.g., Clean Code"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-author" className="block text-xs font-medium text-slate-700 mb-1">
                Author
              </label>
              <input
                id="book-author"
                data-testid="book-author-input"
                type="text"
                required
                value={formState.author}
                onChange={(e) => setFormState((s) => ({ ...s, author: e.target.value }))}
                placeholder="Robert C. Martin"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="book-category" className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <input
                id="book-category"
                data-testid="book-category-input"
                type="text"
                required
                value={formState.category}
                onChange={(e) => setFormState((s) => ({ ...s, category: e.target.value }))}
                placeholder="Software Engineering"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="book-publisher" className="block text-xs font-medium text-slate-700 mb-1">
                Publisher
              </label>
              <input
                id="book-publisher"
                data-testid="book-publisher-input"
                type="text"
                required
                value={formState.publisher}
                onChange={(e) => setFormState((s) => ({ ...s, publisher: e.target.value }))}
                placeholder="Prentice Hall"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="book-year" className="block text-xs font-medium text-slate-700 mb-1">
                Year
              </label>
              <input
                id="book-year"
                data-testid="book-year-input"
                type="number"
                required
                min={1450}
                max={new Date().getFullYear() + 1}
                value={formState.publicationYear}
                onChange={(e) => setFormState((s) => ({ ...s, publicationYear: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="book-total" className="block text-xs font-medium text-slate-700 mb-1">
                  Total
                </label>
                <input
                  id="book-total"
                  data-testid="book-total-input"
                  type="number"
                  required
                  min={1}
                  value={formState.totalCopies}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormState((s) => ({
                      ...s,
                      totalCopies: val,
                      availableCopies: editingBook ? s.availableCopies : val,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="book-avail" className="block text-xs font-medium text-slate-700 mb-1">
                  Avail.
                </label>
                <input
                  id="book-avail"
                  data-testid="book-avail-input"
                  type="number"
                  required
                  min={0}
                  value={formState.availableCopies}
                  onChange={(e) => setFormState((s) => ({ ...s, availableCopies: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="book-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              id="book-desc"
              rows={3}
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
              placeholder="Brief synopsis, edition notes, or shelf location..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

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
              data-testid="save-book-btn"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingBook ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Book Details Modal */}
      <Modal
        open={Boolean(detailBook)}
        onClose={() => setDetailBook(null)}
        title={detailBook?.title ?? 'Book Details'}
        subtitle={detailBook ? `${detailBook.bookId} · ISBN ${detailBook.isbn}` : undefined}
        maxWidthClass="max-w-xl"
      >
        {detailBook && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">Author</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailBook.author}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailBook.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Publisher &amp; Year</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {detailBook.publisher} · {detailBook.publicationYear}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Copies Available</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {detailBook.availableCopies} of {detailBook.totalCopies}
                </p>
              </div>
            </div>

            {detailBook.description && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-1">Synopsis</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{detailBook.description}</p>
              </div>
            )}

            {isAdmin && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Active Borrowers</h4>
                {detailLoading ? (
                  <p className="text-xs text-slate-500">Loading active loans...</p>
                ) : detailBorrows.length === 0 ? (
                  <p className="text-xs text-slate-500">No copies are currently checked out.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {detailBorrows.map((rec) => (
                      <div key={rec.recordId} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-slate-900">{rec.studentName}</span>
                          <span className="ml-2 font-mono text-slate-500">{rec.studentId}</span>
                        </div>
                        <span className={rec.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                          Due {rec.dueDate}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Safe Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Book from Catalog"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}" (${deleteTarget.bookId})? Deletion is blocked automatically if any active copies are currently borrowed.`
            : ''
        }
        confirmLabel="Delete Book"
      />
    </div>
  );
}
