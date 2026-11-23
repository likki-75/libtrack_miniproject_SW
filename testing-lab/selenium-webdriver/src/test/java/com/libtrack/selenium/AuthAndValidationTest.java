package com.libtrack.selenium;

import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import static org.junit.Assert.assertTrue;

public class AuthAndValidationTest extends BaseLibTrackTest {

    @Test
    public void testInvalidCredentialsShowErrorAlert() {
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='login-email']")));
        emailInput.sendKeys("nonexistent@college.edu");
        driver.findElement(By.cssSelector("[data-testid='login-password']")).sendKeys("WrongPassword123");
        driver.findElement(By.cssSelector("[data-testid='login-submit']")).click();

        WebElement errorBanner = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='auth-error']")));
        assertTrue(errorBanner.getText().contains("Invalid email or password"));
    }

    @Test
    public void testValidAdminLoginAndLogout() {
        loginAsAdmin();
        WebElement heading = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("header h1")));
        assertTrue(heading.getText().contains("Dashboard"));

        driver.findElement(By.cssSelector("[data-testid='nav-logout']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='login-email']")));
    }
}
