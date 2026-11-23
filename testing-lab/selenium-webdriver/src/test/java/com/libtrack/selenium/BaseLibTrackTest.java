package com.libtrack.selenium;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.After;
import org.junit.Before;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public abstract class BaseLibTrackTest {

    protected WebDriver driver;
    protected WebDriverWait wait;

    protected String baseUrl() {
        return System.getProperty("libtrack.url", "http://localhost:3000");
    }

    protected String adminEmail() {
        return System.getProperty("libtrack.adminEmail", "");
    }

    protected String adminPassword() {
        return System.getProperty("libtrack.adminPassword", "");
    }

    @Before
    public void setUp() {
        String browser = System.getProperty("browser", "chrome").toLowerCase();
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));

        if ("edge".equals(browser)) {
            WebDriverManager.edgedriver().setup();
            EdgeOptions options = new EdgeOptions();
            if (headless) {
                options.addArguments("--headless=new");
            }
            driver = new EdgeDriver(options);
        } else {
            WebDriverManager.chromedriver().setup();
            ChromeOptions options = new ChromeOptions();
            if (headless) {
                options.addArguments("--headless=new");
            }
            options.addArguments("--window-size=1440,900");
            driver = new ChromeDriver(options);
        }

        wait = new WebDriverWait(driver, Duration.ofSeconds(12));
        driver.get(baseUrl());
    }

    @After
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    protected void loginAsAdmin() {
        String email = adminEmail();
        String password = adminPassword();
        if (email.isEmpty() || password.isEmpty()) {
            throw new IllegalStateException(
                    "Provide -Dlibtrack.adminEmail and -Dlibtrack.adminPassword system properties to run authenticated tests."
            );
        }
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='login-email']")));
        emailInput.clear();
        emailInput.sendKeys(email);

        WebElement passwordInput = driver.findElement(By.cssSelector("[data-testid='login-password']"));
        passwordInput.clear();
        passwordInput.sendKeys(password);

        driver.findElement(By.cssSelector("[data-testid='login-submit']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='nav-books']")));
    }
}
