package com.libtrack.core;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

public class FineCalculator {

    public LocalDate parseIsoDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            throw new LibraryRulesException("Date string must not be null or empty.");
        }
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (DateTimeParseException ex) {
            throw new LibraryRulesException("Invalid calendar date: " + dateStr);
        }
    }

    public long calculateOverdueDays(String issueDateStr, String dueDateStr, String returnDateStr) {
        LocalDate issueDate = parseIsoDate(issueDateStr);
        LocalDate dueDate = parseIsoDate(dueDateStr);
        LocalDate returnDate = parseIsoDate(returnDateStr);

        if (dueDate.isBefore(issueDate)) {
            throw new LibraryRulesException("Due date cannot precede issue date.");
        }
        if (returnDate.isBefore(issueDate)) {
            throw new LibraryRulesException("Return date cannot precede issue date.");
        }
        if (!returnDate.isAfter(dueDate)) {
            return 0L;
        }
        return ChronoUnit.DAYS.between(dueDate, returnDate);
    }

    public double calculateFine(String issueDateStr, String dueDateStr, String returnDateStr, double finePerOverdueDay) {
        if (Double.isNaN(finePerOverdueDay) || finePerOverdueDay < 0) {
            throw new LibraryRulesException("Fine per overdue day must be non-negative.");
        }
        long overdueDays = calculateOverdueDays(issueDateStr, dueDateStr, returnDateStr);
        return Math.round(overdueDays * finePerOverdueDay * 100.0) / 100.0;
    }
}
