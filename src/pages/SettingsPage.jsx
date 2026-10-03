import { useState, useEffect } from 'react';
import {
  Database, Cloud, RefreshCw, CheckCircle2, AlertCircle,
  Copy, Check, Trash2, Download, Upload, ExternalLink,
  ShieldAlert, Sparkles, FileSpreadsheet, ArrowRight
} from 'lucide-react';
import { GoogleSheetsService } from '../services/googleSheetsService';
import {
  clearAllData, restoreDemoData, hasDemoData,
  getAllDataForExport, importAllDataFromJson,
  PatientsService, VisitsService, AppointmentsService, PaymentsService
} from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

// Sample Google Apps Script string for 1-click copy
const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================
 * NisiClinic Dental CRM — Google Apps Script Backend
 * ============================================================
 */
const SHEET_NAMES = { PATIENTS: 'Patients', VISITS: 'Visits', APPOINTMENTS: 'Appointments', PAYMENTS: 'Payments' };

const SCHEMAS = {
  Patients: ['patient_id', 'name', 'phone', 'age', 'gender', 'date_of_birth', 'address', 'medical_notes', 'allergies', 'emergency_contact', 'created_at', 'is_archived'],
  Visits: ['visit_id', 'patient_id', 'visit_date', 'complaint', 'diagnosis', 'clinical_notes', 'treatment', 'medicines_json', 'follow_up_date', 'total_amount', 'amount_paid', 'balance', 'created_by', 'created_at'],
  Appointments: ['appointment_id', 'patient_id', 'date', 'time', 'reason', 'dentist', 'status', 'notes', 'created_at'],
  Payments: ['payment_id', 'patient_id', 'visit_id', 'amount', 'payment_method', 'payment_date', 'notes', 'created_at']
};

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = SCHEMAS[sheetName] || [];
    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EEF2FF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function readSheetData(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row.some(c => c !== '' && c !== null)) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (h === 'medicines_json' && typeof val === 'string' && val.trim().startsWith('[')) {
        try { obj['medicines'] = JSON.parse(val); } catch(e) { obj['medicines'] = []; }
      }
      obj[h] = val;
    });
    rows.push(obj);
  }
  return rows;
}

function objectToRow(obj, schema) {
  return schema.map(h => {
    if (h === 'medicines_json') return JSON.stringify(obj.medicines || []);
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  });
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ping';
    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'NisiClinic Google Sheets API is connected',
        spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
        timestamp: new Date().toISOString()
      });
    }
    if (action === 'getAll') {
      return jsonResponse({
        status: 'success',
        data: {
          patients: readSheetData(SHEET_NAMES.PATIENTS),
          visits: readSheetData(SHEET_NAMES.VISITS),
          appointments: readSheetData(SHEET_NAMES.APPOINTMENTS),
          payments: readSheetData(SHEET_NAMES.PAYMENTS)
        }
      });
    }
    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'syncAll';

    if (action === 'syncAll' && payload.data) {
      if (payload.data.patients) replaceSheet(SHEET_NAMES.PATIENTS, payload.data.patients, SCHEMAS.Patients);
      if (payload.data.visits) replaceSheet(SHEET_NAMES.VISITS, payload.data.visits, SCHEMAS.Visits);
      if (payload.data.appointments) replaceSheet(SHEET_NAMES.APPOINTMENTS, payload.data.appointments, SCHEMAS.Appointments);
      if (payload.data.payments) replaceSheet(SHEET_NAMES.PAYMENTS, payload.data.payments, SCHEMAS.Payments);
      return jsonResponse({ status: 'success', message: 'Synchronized all collections' });
    }

    if (action === 'createPatient' && payload.patient) {
      getOrCreateSheet(SHEET_NAMES.PATIENTS).appendRow(objectToRow(payload.patient, SCHEMAS.Patients));
      return jsonResponse({ status: 'success' });
    }
    if (action === 'createVisit' && payload.visit) {
      getOrCreateSheet(SHEET_NAMES.VISITS).appendRow(objectToRow(payload.visit, SCHEMAS.Visits));
      return jsonResponse({ status: 'success' });
    }
    if (action === 'createAppointment' && payload.appointment) {
      getOrCreateSheet(SHEET_NAMES.APPOINTMENTS).appendRow(objectToRow(payload.appointment, SCHEMAS.Appointments));
      return jsonResponse({ status: 'success' });
    }
    if (action === 'createPayment' && payload.payment) {
      getOrCreateSheet(SHEET_NAMES.PAYMENTS).appendRow(objectToRow(payload.payment, SCHEMAS.Payments));
      return jsonResponse({ status: 'success' });
    }
    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function replaceSheet(sheetName, items, schema) {
  const sheet = getOrCreateSheet(sheetName);
  sheet.clearContents();
  sheet.appendRow(schema);
  sheet.getRange(1, 1, 1, schema.length).setFontWeight('bold').setBackground('#EEF2FF');
  if (items && items.length > 0) {
    const rows = items.map(item => objectToRow(item, schema));
    sheet.getRange(2, 1, rows.length, schema.length).setValues(rows);
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

export default function SettingsPage() {
  const toast = useToast();

  const [sheetsUrl, setSheetsUrl] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [dataStats, setDataStats] = useState({ patients: 0, visits: 0, appointments: 0, payments: 0 });

  useEffect(() => {
    refreshState();
  }, []);

  function refreshState() {
    setSheetsUrl(GoogleSheetsService.getUrl());
    setAutoSync(GoogleSheetsService.getAutoSync());
    setLastSynced(GoogleSheetsService.getLastSynced());
    setIsDemo(hasDemoData());
    setDataStats({
      patients: PatientsService.getAll().length,
      visits: VisitsService.getAll().length,
      appointments: AppointmentsService.getAll().length,
      payments: PaymentsService.getAll().length
    });
  }

  const handleSaveUrl = () => {
    if (!sheetsUrl.trim()) {
      GoogleSheetsService.setUrl('');
      setTestResult(null);
      toast.info('Google Sheets URL removed. Working in local offline storage.');
      refreshState();
      return;
    }

    if (!sheetsUrl.startsWith('https://script.google.com/macros/s/')) {
      toast.error('Invalid URL. It must start with https://script.google.com/macros/s/...');
      return;
    }

    GoogleSheetsService.setUrl(sheetsUrl.trim());
    toast.success('Google Sheets Web App URL saved!');
    refreshState();
  };

  const handleTestConnection = async () => {
    if (!sheetsUrl.trim()) {
      toast.error('Please enter a Google Apps Script Web App URL first.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await GoogleSheetsService.testConnection(sheetsUrl.trim());
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      toast.success(res.message);
      GoogleSheetsService.setUrl(sheetsUrl.trim());
    } else {
      toast.error(res.error);
    }
  };

  const handleToggleAutoSync = (e) => {
    const val = e.target.checked;
    setAutoSync(val);
    GoogleSheetsService.setAutoSync(val);
    toast.info(`Auto-sync ${val ? 'enabled' : 'disabled'}`);
  };

  const handlePullFromSheet = async () => {
    if (!GoogleSheetsService.isConfigured()) {
      toast.error('Please configure and test your Google Sheets URL first.');
      return;
    }

    setSyncing(true);
    try {
      const counts = await GoogleSheetsService.pullFromSheet();
      toast.success(`Synced from Google Sheets: ${counts.patientsCount} patients, ${counts.visitsCount} visits, ${counts.appointmentsCount} appointments.`);
      refreshState();
    } catch (err) {
      toast.error(err.message || 'Failed to pull from Google Sheets.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePushToSheet = async () => {
    if (!GoogleSheetsService.isConfigured()) {
      toast.error('Please configure and test your Google Sheets URL first.');
      return;
    }

    setPushing(true);
    try {
      const allData = getAllDataForExport();
      await GoogleSheetsService.pushToSheet(allData);
      toast.success('Successfully uploaded all local CRM data to Google Sheets!');
      refreshState();
    } catch (err) {
      toast.error(err.message || 'Failed to push to Google Sheets.');
    } finally {
      setPushing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    toast.success('Google Apps Script code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleClearDemoData = () => {
    clearAllData();
    setShowClearModal(false);
    toast.success('Demo data removed. You now have a clean slate for real clinic records!');
    refreshState();
  };

  const handleRestoreDemoData = () => {
    restoreDemoData();
    toast.success('Demo sample data restored.');
    refreshState();
  };

  const handleExportBackup = () => {
    const data = getAllDataForExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nisiclinic_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup file downloaded.');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = importAllDataFromJson(event.target.result);
      if (res.success) {
        toast.success('Backup restored successfully!');
        refreshState();
      } else {
        toast.error('Invalid backup file: ' + res.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isConfigured = GoogleSheetsService.isConfigured();

  return (
    <div className="app-content animate-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Settings & Cloud Sync</h1>
        <p className="page-subtitle">
          Manage your live Google Sheets database, backup real patient records, and control sample data.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        
        {/* Google Sheets Connection Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                background: isConfigured ? 'var(--color-success-light)' : 'var(--color-accent-light)',
                color: isConfigured ? 'var(--color-success)' : 'var(--color-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="card-title">Google Sheets Integration</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Use your Google Sheet as a live spreadsheet database
                </p>
              </div>
            </div>

            <span className={`badge ${isConfigured ? 'badge-confirmed' : 'badge-no-show'}`}>
              {isConfigured ? 'Connected' : 'Local Storage'}
            </span>
          </div>

          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="sheets-url-input">
                Google Apps Script Web App URL
              </label>
              <input
                id="sheets-url-input"
                type="url"
                className="form-input"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                value={sheetsUrl}
                onChange={e => setSheetsUrl(e.target.value)}
              />
              <span className="form-hint">
                Deploy your Google Sheet script as a Web App (access: "Anyone") and paste the URL here.
              </span>
            </div>

            {testResult && (
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                background: testResult.success ? 'var(--color-success-light)' : 'var(--color-error-light)',
                border: `1px solid ${testResult.success ? 'var(--color-success)' : 'var(--color-error)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--font-size-sm)'
              }}>
                {testResult.success ? (
                  <>
                    <CheckCircle2 size={18} color="var(--color-success)" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-success-text)' }}>
                        Connected: {testResult.spreadsheetName || 'Active Google Sheet'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success-text)' }}>
                        Ready to sync Patients, Visits, Appointments, and Payments.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} color="var(--color-error)" />
                    <div style={{ color: 'var(--color-error-text)' }}>{testResult.error}</div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTestConnection}
                disabled={testing || !sheetsUrl}
              >
                <RefreshCw size={14} className={testing ? 'spin' : ''} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveUrl}
              >
                Save URL
              </button>
            </div>

            {isConfigured && (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Live Auto-Sync</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Automatically save newly created patients, visits, appointments to your Google Sheet in background.
                    </div>
                  </div>
                  <label className="form-checkbox" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={handleToggleAutoSync}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handlePullFromSheet}
                    disabled={syncing}
                    title="Pull latest rows from Google Sheets"
                  >
                    <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                    {syncing ? 'Pulling...' : 'Pull from Sheet'}
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handlePushToSheet}
                    disabled={pushing}
                    title="Push local patients and visits to Google Sheets"
                  >
                    <Cloud size={14} />
                    {pushing ? 'Uploading...' : 'Push Local to Sheet'}
                  </button>
                </div>

                {lastSynced && (
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    Last synchronized: {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Real Data vs Demo Data Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                background: isDemo ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                color: isDemo ? 'var(--color-warning)' : 'var(--color-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Database size={20} />
              </div>
              <div>
                <h3 className="card-title">Database & Records</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Current active data state
                </p>
              </div>
            </div>

            <span className={`badge ${isDemo ? 'badge-waiting' : 'badge-completed'}`}>
              {isDemo ? 'Demo Mode' : 'Clean / Real Data'}
            </span>
          </div>

          <div className="card-body">
            {/* Counts summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)',
              marginBottom: 'var(--space-5)', textAlign: 'center'
            }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{dataStats.patients}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Patients</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{dataStats.visits}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Visits</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{dataStats.appointments}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Appts</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{dataStats.payments}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Payments</div>
              </div>
            </div>

            {/* Clear or Load Demo Action */}
            <div style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                Ready to enter real clinic patients?
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                Clear the 8 mock patients and sample records with one click so you can start with a fresh, empty system for your real clinic.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowClearModal(true)}
                  id="clear-demo-data-btn"
                >
                  <Trash2 size={14} />
                  Clear Demo Data
                </button>

                {!isDemo && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleRestoreDemoData}
                  >
                    <Sparkles size={14} />
                    Restore Sample Demo
                  </button>
                )}
              </div>
            </div>

            {/* Backup & Restore */}
            <div style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border-light)'
            }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                Local Data Backup
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportBackup}
                >
                  <Download size={14} />
                  Download JSON Backup
                </button>

                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={14} />
                  Restore from JSON
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportBackup}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Step by step setup guide */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-light)', color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ExternalLink size={20} />
            </div>
            <div>
              <h3 className="card-title">How to Connect Your Google Sheet in 2 Minutes</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Follow these 5 simple steps to set up Google Apps Script as your cloud database.
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleCopyCode}
            id="copy-script-code-btn"
          >
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            {copiedCode ? 'Code Copied!' : 'Copy Script Code'}
          </button>
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>1. Create Sheet</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Go to <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>sheets.new</a> to create a new spreadsheet. Name it <strong>"NisiClinic CRM Database"</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>2. Open Apps Script</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                In your Google Sheet, click the top menu: <strong>Extensions &gt; Apps Script</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>3. Paste Code</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Erase existing code in <code>Code.gs</code>, click the <strong>Copy Script Code</strong> button above, and paste it. Click <strong>Save (Ctrl+S)</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>4. Deploy as Web App</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Click <strong>Deploy &gt; New deployment</strong>. Select <strong>Web app</strong>. Set <em>Who has access</em> to <strong>"Anyone"</strong> (Required). Click <strong>Deploy</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>5. Paste URL Here</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Copy the Web App URL (starts with <code>https://script.google.com/...</code>) and paste it into the input box above, then click <strong>Test Connection</strong>.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Confirmation Modal to Clear Demo Data */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Demo & Sample Data?"
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius-full)',
            background: 'var(--color-error-light)', color: 'var(--color-error)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <ShieldAlert size={28} />
          </div>

          <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Are you sure you want to remove all mock data?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            This will permanently remove the 8 sample demo patients and their visits, payments, and appointments. You will have a clean, blank CRM to begin registering real clinic patients.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowClearModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleClearDemoData}
            >
              Yes, Clear Sample Data
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
