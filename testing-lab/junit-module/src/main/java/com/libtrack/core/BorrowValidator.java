package com.libtrack.core;

public class BorrowValidator {

    public void validateBookInventory(int totalCopies, int availableCopies) {
        if (totalCopies < 1 || totalCopies > 10000) {
            throw new LibraryRulesException("Total copies must be between 1 and 10000.");
        }
        if (availableCopies < 0 || availableCopies > totalCopies) {
            throw new LibraryRulesException("Available copies must be between 0 and total copies.");
        }
    }

    public void validateStudentRecord(String studentId, String fullName, String email, int semester) {
        if (studentId == null || !studentId.trim().matches("^[A-Z0-9_-]{3,32}$")) {
            throw new LibraryRulesException("Invalid Student ID format.");
        }
        if (fullName == null || fullName.trim().length() < 2) {
            throw new LibraryRulesException("Student full name must be at least 2 characters.");
        }
        if (email == null || !email.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new LibraryRulesException("Invalid student email address.");
        }
        if (semester < 1 || semester > 12) {
            throw new LibraryRulesException("Semester must be between 1 and 12.");
        }
    }

    public void validateIssueEligibility(
            boolean studentExists,
            int availableCopies,
            int currentActiveBorrows,
            int maxBorrowingLimit,
            boolean alreadyBorrowedSameBook,
            boolean preventDuplicateIssue
    ) {
        if (!studentExists) {
            throw new LibraryRulesException("Cannot issue book to an invalid or unregistered student.");
        }
        if (availableCopies <= 0) {
            throw new LibraryRulesException("Book is unavailable (0 copies in stock).");
        }
        if (maxBorrowingLimit < 1) {
            throw new LibraryRulesException("Max borrowing limit must be at least 1.");
        }
        if (currentActiveBorrows < 0) {
            throw new LibraryRulesException("Active borrow count cannot be negative.");
        }
        if (currentActiveBorrows >= maxBorrowingLimit) {
            throw new LibraryRulesException("Student has reached the maximum borrowing limit.");
        }
        if (preventDuplicateIssue && alreadyBorrowedSameBook) {
            throw new LibraryRulesException("Student already holds an active copy of this book.");
        }
    }
}
