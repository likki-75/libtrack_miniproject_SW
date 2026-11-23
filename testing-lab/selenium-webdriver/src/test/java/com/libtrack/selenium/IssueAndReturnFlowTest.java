package com.libtrack.selenium;

import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;

import static org.junit.Assert.assertTrue;

public class IssueAndReturnFlowTest extends BaseLibTrackTest {

    @Test
    public void testIssueAndReturnBookWorkflow() {
        loginAsAdmin();

        // Navigate to Issue Books
        driver.findElement(By.cssSelector("[data-testid='nav-issue']")).click();
        WebElement studentSelectEl = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='issue-student-select']")));
        Select studentSelect = new Select(studentSelectEl);
        if (studentSelect.getOptions().size() <= 1) {
            throw new IllegalStateException("At least one student must exist (seed sample data or add a student before running).");
        }
        studentSelect.selectByIndex(1);

        Select bookSelect = new Select(driver.findElement(By.cssSelector("[data-testid='issue-book-select']")));
        if (bookSelect.getOptions().size() <= 1) {
            throw new IllegalStateException("At least one book must exist (seed sample data or add a book before running).");
        }
        bookSelect.selectByIndex(1);

        driver.findElement(By.cssSelector("[data-testid='issue-submit-btn']")).click();
        WebElement issueToast = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[role='status']")));
        assertTrue(issueToast.getText().toLowerCase().contains("issued") || issueToast.getText().toLowerCase().contains("limit"));

        // Navigate to Return Books and verify active borrows table & fine preview
        driver.findElement(By.cssSelector("[data-testid='nav-return']")).click();
        WebElement activeTable = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='active-borrows-table']")));
        assertTrue(activeTable.isDisplayed());

        WebElement firstSelectBtn = driver.findElement(By.xpath("(//button[contains(@data-testid, 'select-return-')])[1]"));
        firstSelectBtn.click();

        WebElement fineAmountEl = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='preview-fine-amount']")));
        assertTrue(fineAmountEl.isDisplayed());
    }
}
