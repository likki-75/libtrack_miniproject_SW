# LibTrack JUnit 4 Core Business Logic Module (Lab Sheet 6)

## Clarification of Scope
This standalone Java + Maven + JUnit 4 module demonstrates **unit testing of equivalent core business logic** (overdue day calculation, fine calculation, borrowing limit validation, book availability validation, and student input validation). It does **not** directly execute the TypeScript/React web application; the web application implements equivalent logic in `server/domain.ts`.

## Prerequisites
- Java JDK 17+
- Apache Maven 3.8+

## Run Unit Tests
```bash
cd testing-lab/junit-module
mvn test
```

## Included Test Suites
- `FineCalculatorTest.java`: Zero fine on/before due date, exact overdue day math, 1-day boundary, invalid calendar dates, return-before-issue rejection, negative fine rate rejection.
- `BorrowValidatorTest.java`: Book inventory `availableCopies <= totalCopies` BVA, student input validation, borrowing limit boundary (`max = 3`), unavailable book rejection, invalid student rejection, duplicate active borrow prevention.
