# 🦷 NisiClinic CRM — Complete Platform Guide & User Manual

Welcome to **NisiClinic CRM**, an Apple-grade, private internal Dental Clinic Management CRM designed specifically for dental practitioners and clinic staff to run their daily practice with zero friction.

---

## 📌 Table of Contents
1. [Platform Overview & Philosophy](#1-platform-overview--philosophy)
2. [User Roles & Access Levels](#2-user-roles--access-levels)
3. [The Core Clinic Workflow (Step-by-Step)](#3-the-core-clinic-workflow-step-by-step)
4. [Detailed Feature Guide by Page](#4-detailed-feature-guide-by-page)
   - [Dashboard](#-dashboard)
   - [Patients Directory & Patient Dossier](#-patients-directory--patient-dossier)
   - [Clinical Visits & Prescriptions](#-clinical-visits--prescriptions)
   - [Appointments Management](#-appointments-management)
   - [Payments & Receivables Analytics](#-payments--receivables-analytics)
   - [Follow-up Tracker](#-follow-up-tracker)
   - [Settings & Google Sheets Sync](#-settings--google-sheets-sync)
5. [Cloud Storage: Google Sheets Integration](#5-cloud-storage-google-sheets-integration)
6. [Managing Real vs. Demo Data](#6-managing-real-vs-demo-data)
7. [Running Locally & Cloud Deployment](#7-running-locally--cloud-deployment)

---

## 1. Platform Overview & Philosophy

NisiClinic CRM is built exclusively for **internal clinic use** (it is not a patient-facing portal). It prioritizes speed, clinical clarity, and effortless financial tracking:

$$\text{Patient} \longrightarrow \text{Appointment} \longrightarrow \text{Visit} \longrightarrow \text{Diagnosis / Notes} \longrightarrow \text{Treatment / Medicines} \longrightarrow \text{Payment / Balance} \longrightarrow \text{Follow-up}$$

### Key Architectural Highlights:
- **Offline-First & Fast**: Runs smoothly even if internet fluctuates. Data is stored instantly in local memory and synced to Google Sheets in the background.
- **Responsive Design**: Full desktop workstation view with a sidebar, plus a tailored mobile layout with a native bottom bar.
- **Zero-Cost Cloud Backend**: Connects directly to Google Sheets using Google Apps Script—no expensive database servers required.

---

## 2. User Roles & Access Levels

NisiClinic CRM supports two dedicated role profiles:

| Role | Default Username | Default Password | What They Can Do |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor` | `nisi2026` | Full clinical authority: clinical notes, diagnoses, dental procedures, prescriptions, billing ledgers, and cloud settings. |
| **Receptionist** | `reception` | `front2026` | Administrative focus: patient intake, scheduling appointments, checking in waiting patients, and collecting payments. |

*(Note: The demo credentials notice has been removed from the public login screen for production security).*

---

## 3. The Core Clinic Workflow (Step-by-Step)

Here is how a patient flows through the clinic from arrival to departure:

### Step 1: Patient Arrival & Registration
- If it's a **New Patient**: Staff clicks **`+ New Patient`** (only Name and Phone number are required; age, address, and allergies are optional).
- If it's an **Existing Patient**: Staff searches their name or phone in the top global search bar.

### Step 2: Appointment / Check-in
- Staff schedules an appointment or changes the appointment status to **"Waiting"** when the patient enters the clinic reception.

### Step 3: Clinical Consultation (The Doctor's Workspace)
- In the dental operatory, the doctor clicks **`+ New Visit`**:
  1. Selects the patient.
  2. Types the **Chief Complaint** (e.g. *"Sharp toothache on lower right side"*).
  3. Records **Clinical Examination & Diagnosis** (e.g. *"Deep dental caries reaching dentin on tooth #30"*).
  4. Enters the **Treatment Done** (e.g. *"Root Canal Treatment - Step 1"*).
  5. Prescribes **Medicines** (click *+ Add Medicine* to specify drug name, dosage, and instructions).
  6. Sets a **Follow-up Date** (optional; automatically creates a future appointment).

### Step 4: Billing & Payment Collection
- On the same visit screen (or from the Payments page):
  - Enter the **Total Treatment Fee** (e.g. `₹3,000`).
  - Enter the **Amount Paid Today** (e.g. `₹1,000`).
  - The CRM **automatically calculates the pending balance** (`₹2,000`).
  - Select payment method: **UPI**, **Cash**, or **Card**.

### Step 5: Post-Procedure Follow-Up
- The CRM automatically reminds staff when patient follow-up checks are due so the clinic can confirm healing or schedule the next treatment stage.

---

## 4. Detailed Feature Guide by Page

### 🏠 Dashboard
- **Daily KPIs**: Quick counters for Today's Appointments, In-Treatment, Revenue collected today, and Total Pending dues.
- **Quick Action Bar**: 1-click shortcuts for *New Patient*, *Book Appointment*, *Record Visit*, *Collect Payment*, and *Follow-ups*.
- **Today's Schedule**: Real-time queue showing patient arrival time, treatment reason, and status progression.
- **Follow-up Alerts**: Highlights patients who require a check-in today.

---

### 👥 Patients Directory & Patient Dossier
- **Search & Filters**: Instant search by patient name, phone number, or patient ID. Filter by *Today*, *Recent*, *Follow-up*, or *Pending Payment*.
- **360° Patient Profile Dossier**:
  - **Medical Alert Banner**: Red badge warning if the patient has allergies (e.g. *Penicillin*) or medical notes (e.g. *Diabetic, Heart patient*).
  - **Overview Tab**: Emergency contact, personal details, total amount spent, and outstanding dues.
  - **Visits Tab**: Complete chronological timeline of every visit, clinical notes, procedures, and prescriptions.
  - **Payments Tab**: History of every receipt and payment method.
  - **Appointments Tab**: Past and upcoming scheduled visits.

---

### 🩺 Clinical Visits & Prescriptions
- **Chief Complaint & Clinical Notes**: Rich text fields to document patient symptoms and clinical findings.
- **Dynamic Prescription Pad**: Add multiple drugs with dosage instructions (e.g. *Amoxicillin 500mg - 1 capsule 3x daily after food*).
- **Auto-Followup**: Checking "Schedule Follow-up" automatically schedules their next visit.

---

### 📅 Appointments Management
- **Status Progression**: Moves patients seamlessly across 4 workflow states:
  - 🔵 **Confirmed** $\to$ Scheduled booking.
  - 🟡 **Waiting** $\to$ Patient has arrived in the waiting lounge.
  - 🟣 **In Treatment** $\to$ Patient is currently in the dental chair with the doctor.
  - 🟢 **Completed** $\to$ Treatment finished.
- **Views**: Filter by *Today*, *This Week*, or *Upcoming*.

---

### 💳 Payments & Receivables Analytics
- **Top Financial KPIs**:
  - **Money Received**: Total cash collected across all visits.
  - **Needs to Get (Pending)**: Total unpaid balance across patients with pending visit dues.
  - **Total Value Billed**: Combined value of all dental procedures conducted.
  - **Collection Rate**: Percentage of revenue collected (e.g., `85% Collected`).
- **Visual Graphs**:
  - **Inflow vs. Pending Ratio Meter**: Dual-colored progress bar (Emerald Green for Received vs. Amber for Needs to Get).
  - **Payment Methods Breakdown**: Percentage breakdown of UPI vs. Cash vs. Card collections.
  - **7-Day Revenue Trend Chart**: Daily interactive bar chart comparing incoming revenue and pending balances.
- **Actionable Tabs**:
  - **Received Payments**: Complete payment transactions ledger with filters.
  - **Needs to Get (Pending Receivables)**: List of all patients who owe money, with their phone number, procedure, balance, and an instant **`+ Collect`** button.

---

### ⏰ Follow-up Tracker
- Categorizes post-treatment follow-ups into **Today**, **Upcoming**, and **Overdue**.
- Displays patient phone numbers and procedure context so front desk staff can call patients for check-ups.

---

### ⚙️ Settings & Google Sheets Sync
- **Google Sheets Cloud Integration**: Connect your Google Spreadsheet with one URL.
- **Real-Time Auto Sync**: Automatically syncs every new patient, visit, and payment to your Google Sheet in the background.
- **Data Management**: Clean slate controls (*Clear Demo Data*, *Restore Sample Data*, *Export/Import JSON Backups*).

---

## 5. Cloud Storage: Google Sheets Integration

Instead of paying for expensive cloud databases, NisiClinic CRM connects directly to **Google Sheets** via **Google Apps Script**:

### How It Works:
1. You deploy a free script inside a Google Spreadsheet (`google-apps-script/Code.gs`).
2. The script acts as a secure REST API Web App.
3. Every time you create a patient, appointment, visit, or payment in NisiClinic CRM, the data is saved locally **AND** appended as a new row in your Google Spreadsheet!

### Auto-Generated Spreadsheet Tables:
- **`Patients`**: `patient_id`, `name`, `phone`, `age`, `gender`, `address`, `allergies`, `medical_notes`, `created_at`
- **`Visits`**: `visit_id`, `patient_id`, `visit_date`, `complaint`, `diagnosis`, `clinical_notes`, `treatment`, `medicines_json`, `total_amount`, `amount_paid`, `balance`
- **`Appointments`**: `appointment_id`, `patient_id`, `date`, `time`, `reason`, `dentist`, `status`, `notes`
- **`Payments`**: `payment_id`, `patient_id`, `visit_id`, `amount`, `payment_method`, `payment_date`, `notes`

---

## 6. Managing Real vs. Demo Data

When you first launch the CRM, it contains 8 sample demo patients to show you how the interface looks with data.

### How to Start Entering Real Clinic Patients:
1. Open the CRM and go to **Google Sheets & Settings** (`/settings`).
2. Under **Database & Records**, click **`Clear Demo Data`**.
3. Confirm the dialog by clicking **`Yes, Clear Sample Data`**.
4. All 8 mock patients and their records will be erased permanently, giving you a fresh, clean, empty CRM ready for your real clinic records.
5. *(Optional)* If you ever want to preview sample records again, click **`Restore Sample Demo`**.

---

## 7. Running Locally & Cloud Deployment

### Running Locally on Your Computer:
```bash
# 1. Install dependencies
npm install

# 2. Start the local server
npm run dev
```
Open **`http://localhost:3000`** in Google Chrome or any browser.

### Cloud Deployment (Netlify):
- The repository is connected to GitHub at: **`https://github.com/Faxhii/nisicrmclinic`**.
- Netlify automatically builds and hosts the app on every GitHub push using the pre-configured [`netlify.toml`](./netlify.toml) and [`public/_redirects`](./public/_redirects).
