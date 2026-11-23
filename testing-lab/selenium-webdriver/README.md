# LibTrack Selenium WebDriver + JUnit 4 Suite (Lab Sheets 8 & 10)

## Prerequisites
1. Java JDK 17+ and Apache Maven 3.8+.
2. Google Chrome or Microsoft Edge installed locally (`webdrivermanager` downloads matching drivers automatically).
3. Running LibTrack instance (`npm run dev` on `http://localhost:3000`), with an initialized Admin account (and sample data seeded via Settings if running `IssueAndReturnFlowTest`).

## Execution Commands
Run against Google Chrome:
```bash
cd testing-lab/selenium-webdriver
mvn test -Dbrowser=chrome -Dlibtrack.url=http://localhost:3000 -Dlibtrack.adminEmail=YOUR_ADMIN_EMAIL -Dlibtrack.adminPassword=YOUR_ADMIN_PASSWORD
```

Run against Microsoft Edge (Lab Sheet 9 Cross-Browser):
```bash
mvn test -Dbrowser=edge -Dlibtrack.url=http://localhost:3000 -Dlibtrack.adminEmail=YOUR_ADMIN_EMAIL -Dlibtrack.adminPassword=YOUR_ADMIN_PASSWORD
```

Run in headless CI mode:
```bash
mvn test -Dbrowser=chrome -Dheadless=true -Dlibtrack.url=http://localhost:3000 -Dlibtrack.adminEmail=YOUR_ADMIN_EMAIL -Dlibtrack.adminPassword=YOUR_ADMIN_PASSWORD
```
