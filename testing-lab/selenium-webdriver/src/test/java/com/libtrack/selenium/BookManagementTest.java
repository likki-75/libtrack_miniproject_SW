package com.libtrack.selenium;

import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import static org.junit.Assert.assertTrue;

public class BookManagementTest extends BaseLibTrackTest {

    @Test
    public void testCreateAndSearchBookAndVerifyValidationMessage() {
        loginAsAdmin();
        driver.findElement(By.cssSelector("[data-testid='nav-books']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='add-book-btn']"))).click();

        String uniqueId = "BK-SEL-" + (System.currentTimeMillis() % 10000);
        String uniqueIsbn = "978" + String.valueOf(System.currentTimeMillis()).substring(3, 13);

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='book-id-input']"))).clear();
        driver.findElement(By.cssSelector("[data-testid='book-id-input']")).sendKeys(uniqueId);
        driver.findElement(By.cssSelector("[data-testid='book-isbn-input']")).sendKeys(uniqueIsbn);
        driver.findElement(By.cssSelector("[data-testid='book-title-input']")).sendKeys("Selenium Testing Handbook");
        driver.findElement(By.cssSelector("[data-testid='book-author-input']")).sendKeys("Alan Richardson");
        driver.findElement(By.cssSelector("[data-testid='book-category-input']")).clear();
        driver.findElement(By.cssSelector("[data-testid='book-category-input']")).sendKeys("Software Testing");
        driver.findElement(By.cssSelector("[data-testid='book-publisher-input']")).sendKeys("Compendium");

        // Trigger validation check: availableCopies > totalCopies
        WebElement totalInput = driver.findElement(By.cssSelector("[data-testid='book-total-input']"));
        totalInput.clear();
        totalInput.sendKeys("2");
        WebElement availInput = driver.findElement(By.cssSelector("[data-testid='book-avail-input']"));
        availInput.clear();
        availInput.sendKeys("5");
        driver.findElement(By.cssSelector("[data-testid='save-book-btn']")).click();

        WebElement validationErr = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='book-form-error']")));
        assertTrue(validationErr.getText().contains("Available copies must be between 0 and total copies"));

        // Fix availableCopies and save
        availInput.clear();
        availInput.sendKeys("2");
        driver.findElement(By.cssSelector("[data-testid='save-book-btn']")).click();

        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='book-search-input']")));
        searchInput.sendKeys("Selenium Testing Handbook");

        WebElement table = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='books-table']")));
        assertTrue(table.getText().contains(uniqueId));
        assertTrue(table.getText().contains("Selenium Testing Handbook"));
    }
}
