# Lab Sheet 7: Selenium IDE Test Scenarios for LibTrack

Use the **Selenium IDE** browser extension (Chrome or Microsoft Edge) to record and replay the following five end-to-end scenarios against your running LibTrack instance (`http://localhost:3000`).

---

## Recording & Replay Instructions
1. Start the LibTrack server locally (`npm run dev`) and confirm it is reachable at `http://localhost:3000`.
2. Open Google Chrome or Microsoft Edge and launch the **Selenium IDE** extension.
3. Click **Create a new project** and name it `LibTrack_Lab7`.
4. Set **Playback base URL** to `http://localhost:3000`.
5. For each scenario below, click **Record (REC)**, perform the steps exactly, click **Stop**, then click **Run current test** to verify deterministic replay.

---

## Scenario 1: Admin Login (`TC_IDE_01`)
1. `open` `/`
2. `type` `css=[data-testid="login-email"]` → `<your-admin-email>`
3. `type` `css=[data-testid="login-password"]` → `<your-admin-password>`
4. `click` `css=[data-testid="login-submit"]`
5. `waitForElementPresent` `css=[data-testid="nav-books"]`
6. `assertText` `css=h1` → `Dashboard`

## Scenario 2: Search Book (`TC_IDE_02`)
1. `click` `css=[data-testid="nav-books"]`
2. `type` `css=[data-testid="book-search-input"]` → `Clean Code`
3. `assertElementPresent` `css=[data-testid="books-table"]`
4. `verifyText` `css=[data-testid="books-table"]` → `*Clean Code*`

## Scenario 3: Add Book (`TC_IDE_03`)
1. `click` `css=[data-testid="nav-books"]`
2. `click` `css=[data-testid="add-book-btn"]`
3. `type` `css=[data-testid="book-id-input"]` → `BK-9001`
4. `type` `css=[data-testid="book-isbn-input"]` → `9780134494166`
5. `type` `css=[data-testid="book-title-input"]` → `Clean Architecture`
6. `type` `css=[data-testid="book-author-input"]` → `Robert C. Martin`
7. `type` `css=[data-testid="book-category-input"]` → `Software Engineering`
8. `type` `css=[data-testid="book-publisher-input"]` → `Pearson`
9. `type` `css=[data-testid="book-year-input"]` → `2017`
10. `type` `css=[data-testid="book-total-input"]` → `4`
11. `click` `css=[data-testid="save-book-btn"]`
12. `waitForText` `css=[data-testid="books-table"]` → `*Clean Architecture*`

## Scenario 4: Issue Book (`TC_IDE_04`)
1. `click` `css=[data-testid="nav-issue"]`
2. `select` `css=[data-testid="issue-student-select"]` → `index=1`
3. `select` `css=[data-testid="issue-book-select"]` → `index=1`
4. `click` `css=[data-testid="issue-submit-btn"]`
5. `waitForElementPresent` `css=[role="status"]`

## Scenario 5: Return Book (`TC_IDE_05`)
1. `click` `css=[data-testid="nav-return"]`
2. `waitForElementPresent` `css=[data-testid="active-borrows-table"]`
3. `click` `xpath=(//button[contains(@data-testid, "select-return-")])[1]`
4. `waitForElementPresent` `css=[data-testid="preview-fine-amount"]`
5. `click` `css=[data-testid="confirm-return-btn"]`
6. If overdue fine confirmation modal opens: `click` `css=[data-testid="confirm-dialog-submit"]`
7. `waitForElementPresent` `css=[role="status"]`
