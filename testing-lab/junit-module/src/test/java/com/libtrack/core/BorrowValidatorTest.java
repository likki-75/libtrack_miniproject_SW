package com.libtrack.core;

import org.junit.Before;
import org.junit.Test;

public class BorrowValidatorTest {

    private BorrowValidator validator;

    @Before
    public void setUp() {
        validator = new BorrowValidator();
    }

    @Test
    public void testValidBookInventoryBoundaryValues() {
        validator.validateBookInventory(5, 0);
        validator.validateBookInventory(5, 5);
    }

    @Test(expected = LibraryRulesException.class)
    public void testAvailableCopiesExceedingTotalThrows() {
        validator.validateBookInventory(5, 6);
    }

    @Test(expected = LibraryRulesException.class)
    public void testNegativeAvailableCopiesThrows() {
        validator.validateBookInventory(5, -1);
    }

    @Test
    public void testValidStudentInputs() {
        validator.validateStudentRecord("STU-2026-001", "Aarav Sharma", "aarav@college.edu", 6);
    }

    @Test(expected = LibraryRulesException.class)
    public void testInvalidStudentEmailThrows() {
        validator.validateStudentRecord("STU-2026-001", "Aarav Sharma", "invalid-email", 6);
    }

    @Test(expected = LibraryRulesException.class)
    public void testInvalidSemesterBoundaryThrows() {
        validator.validateStudentRecord("STU-2026-001", "Aarav Sharma", "aarav@college.edu", 13);
    }

    @Test
    public void testIssueAllowedWithinBorrowingLimit() {
        validator.validateIssueEligibility(true, 1, 2, 3, false, true);
    }

    @Test(expected = LibraryRulesException.class)
    public void testIssueBlockedAtBorrowingLimitBoundary() {
        validator.validateIssueEligibility(true, 2, 3, 3, false, true);
    }

    @Test(expected = LibraryRulesException.class)
    public void testIssueBlockedWhenZeroCopiesAvailable() {
        validator.validateIssueEligibility(true, 0, 0, 3, false, true);
    }

    @Test(expected = LibraryRulesException.class)
    public void testIssueBlockedForInvalidStudent() {
        validator.validateIssueEligibility(false, 2, 0, 3, false, true);
    }

    @Test(expected = LibraryRulesException.class)
    public void testDuplicateActiveIssueBlocked() {
        validator.validateIssueEligibility(true, 2, 1, 3, true, true);
    }
}
