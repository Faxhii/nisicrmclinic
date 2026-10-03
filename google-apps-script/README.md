# NisiClinic CRM — Google Sheets Integration Guide

This guide explains how to connect your **NisiClinic Dental CRM** directly to a **Google Spreadsheet** using **Google Apps Script**.

---

## 🚀 Quick Setup in 2 Minutes

### Step 1: Create a Google Spreadsheet
1. Open [Google Sheets](https://sheets.new).
2. Name your spreadsheet: **`NisiClinic CRM Database`**.

### Step 2: Open the Script Editor
1. In your new Google Sheet, click the top menu: **Extensions** $\to$ **Apps Script**.
2. A new tab will open with a code editor showing a file named `Code.gs`.

### Step 3: Paste the CRM Backend Script
1. Delete any existing code in `Code.gs`.
2. Open the file [`google-apps-script/Code.gs`](file:///c:/Users/Lenovo/nisiclincCRM/google-apps-script/Code.gs) or copy it directly from the CRM in **Settings & Google Sheets**.
3. Paste the code into the `Code.gs` editor in Apps Script.
4. Click the **Save** icon (or press `Ctrl + S` / `Cmd + S`).

### Step 4: Deploy as a Web App
1. At the top right of the Google Apps Script editor, click **Deploy** $\to$ **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Fill in the fields:
   - **Description**: `NisiClinic CRM API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: **`Anyone`**  *(⚠️ Important: Do not set to "Only myself", otherwise the CRM cannot write to the sheet)*.
4. Click **Deploy**.
5. Google will ask you to **Authorize access**:
   - Click *Review Permissions*.
   - Choose your Google Account.
   - Click *Advanced* $\to$ *Go to NisiClinic CRM API (unsafe)*.
   - Click *Allow*.
6. Copy the generated **Web app URL** (it starts with `https://script.google.com/macros/s/.../exec`).

### Step 5: Connect in NisiClinic CRM
1. In NisiClinic CRM, go to **Settings & Cloud Sync** (via sidebar or the cloud badge in the header).
2. Paste your **Web app URL** in the input field.
3. Click **Test Connection**. You should see a green checkmark confirming: `Connected: NisiClinic CRM Database`.
4. Click **Save URL**.

---

## 📊 How the Data Sync Works

Once connected:
- **Automatic Sheet Generation**: The script automatically creates 4 sheets with formatted headers:
  1. `Patients`: All demographics, contact info, medical alerts.
  2. `Visits`: Dates, complaints, diagnoses, clinical notes, treatments, medicines (JSON), totals & balances.
  3. `Appointments`: Dates, times, reasons, assigned dentists, and real-time status.
  4. `Payments`: Amounts, dates, methods (Cash, Card, UPI), and visit references.
- **Live Background Auto-Sync**: Whenever a doctor or receptionist creates a patient, registers a visit, schedules an appointment, or collects a payment, the CRM pushes the update to Google Sheets immediately.
- **Push Local to Sheet**: If you previously had offline records in your browser, click **Push Local to Sheet** in Settings to upload them all at once.
- **Pull from Sheet**: If staff edits data directly inside Google Sheets, click **Pull from Sheet** in Settings to refresh the local CRM state.

---

## 🧹 Clearing Demo / Mock Data
To remove the 8 built-in sample demo patients:
1. Navigate to **Settings & Cloud Sync** in the CRM.
2. Click **Clear Demo Data**.
3. Confirm the prompt.
4. The CRM is now 100% empty and ready for real clinic patients!
