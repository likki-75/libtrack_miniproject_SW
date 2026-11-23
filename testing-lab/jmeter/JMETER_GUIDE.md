# Lab Sheet 13: Apache JMeter Performance Testing Guide

## 1. Overview & Architecture Note
LibTrack runs a Node.js + Express backend API (`/api/*`) backed by persistent SQLite (`data/libtrack.sqlite`) on port `3000`. All core endpoints (`/api/health`, `/api/auth/login`, `/api/books`, `/api/dashboard/stats`, `/api/borrow/records`) can be tested directly with Apache JMeter HTTP Request Samplers.

> **Important Note on Firebase Endpoints (If Migrating to Firestore):**
> If you migrate LibTrack to client-side Firebase SDK + Firestore, raw JMeter HTTP samplers cannot easily call Firestore directly without obtaining short-lived Firebase ID tokens via the Identity Toolkit REST API (`accounts:signInWithPassword`) and passing `Authorization: Bearer <idToken>` to the Firestore REST API (`firestore.googleapis.com/v1/...`), and doing so against Spark free tier can trigger Firestore daily read/write quota limits (`429 Quota exceeded`). Express `/api/*` endpoints avoid those client SDK restrictions and provide clean, measurable REST benchmarking.

---

## 2. Pre-Built Test Plan Included
Open `/testing-lab/jmeter/LibTrack_Performance_Test.jmx` in Apache JMeter 5.6+.

### Test Plan Components Configured:
1. **Test Plan & User Defined Variables**:
   - `HOST`: `localhost`
   - `PORT`: `3000`
   - `PROTOCOL`: `http`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: Replace with the Admin account you created during Initial Setup.
2. **Thread Group (`Library Concurrent Users Thread Group`)**:
   - **Number of Threads (Users)**: `20`
   - **Ramp-Up Period (seconds)**: `10` (2 new virtual users/sec)
   - **Loop Count**: `5` (100 total iterations across 4 samplers = 400 requests)
3. **HTTP Cookie Manager**:
   - Automatically stores and sends the `HttpOnly` `libtrack_session` cookie returned by `/api/auth/login` for subsequent `/api/books` and `/api/dashboard/stats` samplers.
4. **HTTP Header Manager**:
   - `Content-Type: application/json`
   - `Accept: application/json`
5. **HTTP Request Samplers**:
   - `1. Health Check` (`GET /api/health`)
   - `2. Login Session` (`POST /api/auth/login`)
   - `3. Fetch Books Catalog` (`GET /api/books`)
   - `4. Fetch Dashboard Stats` (`GET /api/dashboard/stats`)
6. **Response Assertions**:
   - Verifies HTTP `200` status code and expected JSON keys (`books`, `totalBooks`).
7. **Listeners**:
   - **View Results Tree**: Used during initial debugging (1–2 threads) to inspect request/response headers and JSON bodies. Disable during heavy load runs to save memory.
   - **Summary Report**: Records Samples, Average Response Time (ms), Min, Max, Std. Dev., **Error %**, and **Throughput (requests/sec)**.

---

## 3. How to Execute & Record Real Metrics
1. Start the LibTrack server: `npm run dev` (or `npm run build && npm start`).
2. Seed sample data via Settings if you want realistic catalog/borrow payloads.
3. For debugging in GUI mode: open `LibTrack_Performance_Test.jmx`, set Threads=`1`, Loop=`1`, run, and verify green results in **View Results Tree**.
4. For real load measurement (CLI Non-GUI mode recommended):
   ```bash
   jmeter -n -t testing-lab/jmeter/LibTrack_Performance_Test.jmx -l testing-lab/jmeter/results.jtl -e -o testing-lab/jmeter/html-report
   ```
5. Record your actual observed values in the table below (do not fabricate metrics before running):

| Sampler Label | Samples | Avg Response Time (ms) | Min (ms) | Max (ms) | Throughput (req/sec) | Error % |
|---|---:|---:|---:|---:|---:|---:|
| 1. Health Check | *Pending Run* | *—* | *—* | *—* | *—* | *—* |
| 2. Login Session | *Pending Run* | *—* | *—* | *—* | *—* | *—* |
| 3. Fetch Books Catalog | *Pending Run* | *—* | *—* | *—* | *—* | *—* |
| 4. Fetch Dashboard Stats | *Pending Run* | *—* | *—* | *—* | *—* | *—* |
