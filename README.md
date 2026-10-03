# 🦷 NisiClinic CRM — Premium Dental Clinic Management

NisiClinic CRM is an Apple-grade, private internal Dental Clinic Management CRM designed specifically for dental practitioners and clinic staff to seamlessly manage patients, consultations, treatments, medicines, appointments, and payments.

---

## 🌟 Key Features

- **Clinical Consultation Workflow**: Patient intake $\to$ Appointment $\to$ Visit $\to$ Chief Complaint $\to$ Diagnosis & Clinical Notes $\to$ Treatment & Prescription $\to$ Payment & Balance $\to$ Post-procedure Follow-up.
- **360° Patient Dossiers**: Comprehensive patient profiles tracking medical alerts, allergies, past visits, prescriptions, payment history, and appointments.
- **Financial Analytics & Cash Flow Tracking**: Real-time KPI summary cards (*Money Received, Needs to Get / Pending Receivables, Total Value Billed, Collection Rate*), dual-color cash inflow ratio meter, and interactive 7-day revenue trend bar charts.
- **Actionable Receivables Ledger**: Instant tracking of all patients with outstanding balances ("Needs to Get") with a 1-click **Collect** button.
- **Google Sheets Cloud Database Sync**: Built-in Google Apps Script integration enabling live synchronization to Google Sheets for zero-cost, serverless cloud storage.
- **Role-Based Access Control (RBAC)**:
  - **Doctor**: Full access to clinical notes, diagnosis, prescriptions, and financial ledgers.
  - **Receptionist**: Dedicated access to appointments, patient registration, and payment collection.
- **Offline-First & Fast**: Built with React 19 and Vite with zero lag, instant search, and graceful offline fallback.
- **Responsive Design**: Tailored desktop workspace with collapsible sidebar and a native-feeling mobile bottom bar.

---

## 🚀 Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Styling**: Modern Vanilla CSS Design System with curated medical tokens and dark/light contrast.
- **Cloud Backend**: Google Apps Script (`google-apps-script/Code.gs`) connected to Google Sheets.

---

## 💻 Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Faxhii/nisicrmclinic.git
cd nisicrmclinic
npm install
```

### 2. Development Server
Start the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
Validate and compile the production bundle:
```bash
npm run build
```

---

## 🔐 Default Demo Credentials

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor` | `nisi2026` | Full clinical & billing privileges |
| **Receptionist** | `reception` | `front2026` | Patient intake, appointments, payment collection |

---

## ☁️ Google Sheets Integration

1. Create a spreadsheet at [sheets.new](https://sheets.new) named **"NisiClinic CRM Database"**.
2. Click **Extensions > Apps Script**, paste the code from [`google-apps-script/Code.gs`](./google-apps-script/Code.gs), and save.
3. Click **Deploy > New deployment**, select **Web app**, set *Who has access* to **"Anyone"**, and deploy.
4. In NisiClinic CRM, go to **Settings & Cloud Sync**, paste your Web App URL, and click **Test Connection** & **Save URL**.

Full setup details and screenshots are documented in [`google-apps-script/README.md`](./google-apps-script/README.md).

---

## 📄 License
Private internal software for NisiClinic.
