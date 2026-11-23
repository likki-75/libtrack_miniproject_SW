package com.libtrack.core;

import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class FineCalculatorTest {

    private FineCalculator calculator;

    @Before
    public void setUp() {
        calculator = new FineCalculator();
    }

    @Test
    public void testZeroFineWhenReturnedOnDueDate() {
        double fine = calculator.calculateFine("2026-11-01", "2026-11-15", "2026-11-15", 5.0);
        assertEquals(0.0, fine, 0.001);
    }

    @Test
    public void testZeroFineWhenReturnedBeforeDueDate() {
        long overdue = calculator.calculateOverdueDays("2026-11-01", "2026-11-15", "2026-11-10");
        double fine = calculator.calculateFine("2026-11-01", "2026-11-15", "2026-11-10", 5.0);
        assertEquals(0L, overdue);
        assertEquals(0.0, fine, 0.001);
    }

    @Test
    public void testExactFineForOverdueDays() {
        long overdue = calculator.calculateOverdueDays("2026-11-01", "2026-11-15", "2026-11-19");
        double fine = calculator.calculateFine("2026-11-01", "2026-11-15", "2026-11-19", 5.0);
        assertEquals(4L, overdue);
        assertEquals(20.0, fine, 0.001);
    }

    @Test
    public void testOneDayOverdueBoundary() {
        double fine = calculator.calculateFine("2026-11-01", "2026-11-15", "2026-11-16", 7.5);
        assertEquals(7.5, fine, 0.001);
    }

    @Test(expected = LibraryRulesException.class)
    public void testRejectsReturnBeforeIssueDate() {
        calculator.calculateFine("2026-11-10", "2026-11-24", "2026-11-08", 5.0);
    }

    @Test(expected = LibraryRulesException.class)
    public void testRejectsInvalidCalendarDate() {
        calculator.calculateFine("2026-11-01", "2026-11-15", "2026-02-30", 5.0);
    }

    @Test(expected = LibraryRulesException.class)
    public void testRejectsEmptyDateInput() {
        calculator.calculateOverdueDays("2026-11-01", "2026-11-15", "");
    }

    @Test(expected = LibraryRulesException.class)
    public void testRejectsNegativeFineRate() {
        calculator.calculateFine("2026-11-01", "2026-11-15", "2026-11-20", -5.0);
    }
}
