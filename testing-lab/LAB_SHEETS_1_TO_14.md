# Software Testing Lab Mini Project Documentation (Lab Sheets 1–14)
**Project Topic:** Topic 7 — Library Management and Book Borrowing System (**LibTrack**)

---

## Lab Sheet 1: Introduction to Software Testing, SDLC vs STLC
- **SDLC (Software Development Life Cycle):** Requirements Gathering → System Design → Implementation (React + TypeScript + Express + SQLite) → Integration & Testing → Deployment → Maintenance.
- **STLC (Software Testing Life Cycle):** Requirement Analysis → Test Planning → Test Case Development → Test Environment Setup → Test Execution → Test Cycle Closure.
- **Key Requirements Tested:** Role-based authentication (Admin vs Student), Book CRUD with inventory integrity, Student CRUD with duplicate ID prevention, Atomic Issue/Return transactions, Configurable Fine Calculation, Borrowing History filtering/pagination, and Testing Dashboard metrics.
- **Test Objectives:** Ensure zero negative copy drift, strict RBAC enforcement (HTTP 403 for student mutations), accurate fine arithmetic, and responsive UI across viewports.

---

## Lab Sheet 2: Manual Testing Scenarios
Covered in the in-app **Testing Dashboard → Test Cases** module:
- **Functional:** Admin Setup, Login, Invalid Credentials, Add/Edit/Delete/Search Books, Student Registration & History, Book Issue, Book Return, Fine Calculation, Validation rules.
- **Non-Functional:** WCAG AA contrast, responsive mobile/tablet/desktop layout, API authorization checks (401/403), response latency under concurrent reads.

---

## Lab Sheet 3: Boundary Value Analysis (BVA) & Equivalence Class Partitioning (ECP)
| Field / Rule | Valid Equivalence Class | Invalid Equivalence Classes | Boundary Test Cases |
|---|---|---|---|
| **Borrowing Limit** (`max = 3`) | `0 <= active < 3` | `active >= 3` | `2` (Allow), `3` (Reject), `4` (Reject) |
| **Available Copies** (`total = 5`) | `0 <= avail <= 5` | `avail < 0`, `avail > 5` | `-1` (Error), `0` (Valid), `5` (Valid), `6` (Error) |
| **Semester** | `1 <= sem <= 12` | `sem <= 0`, `sem >= 13`, decimal | `0` (Error), `1` (Valid), `12` (Valid), `13` (Error) |
| **Fine Calculation** (`rate = 5`) | `return <= due` (`0`), `return > due` | `return < issue` (Invalid) | `-1d` (`0`), `0d` (`0`), `1d` (`5`), `10d` (`50`) |
| **Book Title / Name** | `2..200` chars | Empty `""`, `1` char, `>200` chars | `1` char (Err), `2` chars (Valid), `200` chars (Valid) |

---

## Lab Sheet 4: Decision Table & State Transition Testing
### Decision Table: Book Issuing
| Condition / Action | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| Valid Student Exists? | Y | Y | Y | Y | N |
| Book Available Copies > 0? | Y | Y | Y | N | — |
| Student Active Loans < Max Limit? | Y | Y | N | — | — |
| No Duplicate Active Issue of Same Book? | Y | N | — | — | — |
| **Action: Issue Book & Decrement Copy** | **Allow (201)** | **Block (409)** | **Block (409)** | **Block (409)** | **Block (404)** |

### State Transition Table
| Current State | Event | Next State | Valid? |
|---|---|---|---|
| `Available` | `issueBook()` | `Borrowed` | Yes (`availableCopies - 1`) |
| `Borrowed` | `dueDate < today` | `Overdue` | Yes |
| `Borrowed` | `returnBook()` on/before due | `Returned` | Yes (`fine = 0`, `availableCopies + 1`) |
| `Overdue` | `returnBook()` after due | `Returned` | Yes (`fine = days * rate`, `availableCopies + 1`) |
| `Returned` | `returnBook()` (duplicate) | *Rejected (409)* | **No (Invalid transition)** |
| `Unavailable (0 copies)` | `issueBook()` | *Rejected (409)* | **No (Invalid transition)** |

---

## Lab Sheet 5: Control Flow Graph (CFG) & Path Coverage
Target Function: `calculateFine(issueDate, dueDate, returnDate, finePerDay)` in `server/domain.ts`:
- **Nodes (`N = 8`):** N1 (Start), N2 (Parse/Validate Dates), N3 (Throw Validation Error), N4 (`returnDate < issueDate?`), N5 (`returnDate <= dueDate?`), N6 (`fine = 0`), N7 (`fine = overdueDays * rate`), N8 (End).
- **Edges (`E = 10`)**, **Decision Points (`P = 3`)**.
- **Cyclomatic Complexity:** `V(G) = E - N + 2 = 10 - 8 + 2 = 4` (or `P + 1 = 4`).
- **4 Independent Basis Paths:**
  1. `N1 → N2 → N3 → N8` (Invalid date string such as `2026-02-30`)
  2. `N1 → N2 → N4 → N3 → N8` (Return date earlier than issue date)
  3. `N1 → N2 → N4 → N5 → N6 → N8` (Returned on or before due date → ₹0)
  4. `N1 → N2 → N4 → N5 → N7 → N8` (Returned after due date → overdueDays * rate)

---

## Lab Sheet 6: JUnit 4 Unit Testing Module
- Located at `testing-lab/junit-module/`.
- Uses Java 17 + JUnit `4.13.2` + Maven Surefire (`mvn test`).
- **Scope Disclosure:** Tests Java classes (`FineCalculator.java`, `BorrowValidator.java`) implementing equivalent core business logic rather than executing the browser React UI directly.

---

## Lab Sheet 7: Selenium IDE
- Located at `testing-lab/selenium-ide/SELENIUM_IDE_SCENARIOS.md`.
- Provides exact recording & playback steps for Login, Search Book, Add Book, Issue Book, and Return Book.

---

## Lab Sheets 8 & 10: Selenium WebDriver with JUnit 4
- Located at `testing-lab/selenium-webdriver/`.
- Includes `BaseLibTrackTest.java` (`@Before` / `@After`), `AuthAndValidationTest.java`, `BookManagementTest.java`, and `IssueAndReturnFlowTest.java`.

---

## Lab Sheet 9: Cross-Browser Testing Checklist (Google Chrome & Microsoft Edge)
> **Honesty Note:** Automated cross-browser execution has **not** been run in this cloud container (no Java/browser binary installed here). Execute locally with `-Dbrowser=chrome` and `-Dbrowser=edge` and fill in your observed results.

| Checklist Item | Google Chrome | Microsoft Edge | Notes |
|---|---|---|---|
| Initial Admin Setup & Login renders cleanly | *Not Executed* | *Not Executed* | Test at 1440x900 and 375x812 |
| Collapsible Sidebar & Top Bar alignment | *Not Executed* | *Not Executed* | Verify zero horizontal overflow |
| Book CRUD Modal & Validation messages | *Not Executed* | *Not Executed* | Verify `availableCopies <= totalCopies` |
| Date Input (`<input type="date">`) on Issue/Return | *Not Executed* | *Not Executed* | Verify `min={issueDate}` enforcement |
| Fine Preview & Confirmation Dialog | *Not Executed* | *Not Executed* | Verify modal focus & backdrop |
| CSV Export Download in Borrowing History | *Not Executed* | *Not Executed* | Verify `.csv` file downloads cleanly |

---

## Lab Sheet 11: Bug Reporting & Tracking
- Implemented interactively in **Testing Dashboard → Defect Tracker**.
- Models Bugzilla / MantisBT severity (`Blocker`..`Trivial`), priority (`P1`..`P4`), and lifecycle (`New → Open → In Progress → Fixed → Retested → Closed`) internally inside LibTrack.

---

## Lab Sheet 12: Test Case Execution & Defect Tracking
- Workflow: Create/Import Test Case → Execute Scenario → Record Actual Result → Mark `Pass`/`Fail`/`Blocked` → Link Defect ID (`BUG-xxx`) → Inspect live computed Pass % & Failure % in **Testing Dashboard → Summary & Report**.

---

## Lab Sheet 13: Apache JMeter Performance Testing
- Located at `testing-lab/jmeter/LibTrack_Performance_Test.jmx` and `testing-lab/jmeter/JMETER_GUIDE.md`.

---

## Lab Sheet 14: Master Test Plan & Final Test Summary Report Template
- Interactive **Test Plan** and printable **Test Summary Report** are built directly into **Testing Dashboard → Summary & Report** and **Test Plan & Labs 1–14**.
- Before faculty submission, run your manual/Selenium/JMeter test passes, record every actual result in the Testing Dashboard, and click **Print Test Report** to generate your final PDF summary.
