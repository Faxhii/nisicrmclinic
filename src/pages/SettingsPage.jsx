import { useState, useEffect } from 'react';
import {
  Database, Cloud, RefreshCw, CheckCircle2, AlertCircle,
  Copy, Check, Trash2, Download, Upload, ExternalLink,
  ShieldAlert, Sparkles, Server, Eye, EyeOff, Terminal
} from 'lucide-react';
import { SupabaseService } from '../services/supabaseService';
import {
  getSupabaseCredentials, saveSupabaseConfig,
  clearSupabaseConfig, testSupabaseConnection
} from '../services/supabaseClient';
import {
  clearAllData, restoreDemoData, hasDemoData,
  getAllDataForExport, importAllDataFromJson,
  PatientsService, VisitsService, AppointmentsService, PaymentsService,
  reconcilePayments
} from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

// Supabase PostgreSQL Schema SQL for 1-click copy
const SUPABASE_SCHEMA_SQL = `-- ============================================================
-- NisiClinic CRM — Supabase Database Schema
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age TEXT,
  gender TEXT,
  date_of_birth TEXT,
  address TEXT,
  medical_notes TEXT,
  allergies TEXT,
  emergency_contact TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  complaint TEXT,
  diagnosis TEXT,
  clinical_notes TEXT,
  treatment TEXT,
  medicines JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  balance NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  follow_up_date DATE,
  created_by TEXT DEFAULT 'doctor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  reason TEXT,
  dentist TEXT DEFAULT 'Dr. Nisi',
  status TEXT DEFAULT 'Confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Tablet',
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  stock_qty INTEGER DEFAULT 0,
  unit_price NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_stock_logs (
  log_id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL REFERENCES medicines(medicine_id) ON DELETE CASCADE,
  change_qty INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_visit_id ON payments(visit_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);

-- Enable Row Level Security & Public Access for CRM
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_stock_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access on patients" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access on visits" ON visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access on payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access on appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access on medicines" ON medicines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access on medicine_stock_logs" ON medicine_stock_logs FOR ALL USING (true) WITH CHECK (true);
`;

export default function SettingsPage() {
  const toast = useToast();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [copiedSchema, setCopiedSchema] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [dataStats, setDataStats] = useState({ patients: 0, visits: 0, appointments: 0, payments: 0 });

  useEffect(() => {
    refreshState();
  }, []);

  function refreshState() {
    const creds = getSupabaseCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseKey(creds.key);
    setIsDemo(hasDemoData());
    setDataStats({
      patients: PatientsService.getAll().length,
      visits: VisitsService.getAll().length,
      appointments: AppointmentsService.getAll().length,
      payments: PaymentsService.getAll().length
    });
  }

  const handleSaveConfig = async () => {
    if (!supabaseUrl.trim() && !supabaseKey.trim()) {
      clearSupabaseConfig();
      setTestResult(null);
      toast.info('Supabase credentials cleared. Working in local storage mode.');
      refreshState();
      return;
    }

    if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
      toast.error('Invalid URL. It must start with https:// (e.g. https://your-ref.supabase.co)');
      return;
    }

    if (!supabaseKey.trim()) {
      toast.error('Please enter your Supabase anon/public API key.');
      return;
    }

    saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    toast.success('Supabase credentials saved!');

    // Automatically test & pull cloud data right away
    setSyncing(true);
    try {
      const counts = await SupabaseService.pullAll();
      reconcilePayments();
      if (counts) {
        toast.success(`Connected & Synced! Loaded ${counts.patientsCount} patients, ${counts.visitsCount} visits, ${counts.paymentsCount} payments from Supabase.`);
      }
    } catch (err) {
      console.warn('Initial Supabase pull notice:', err);
    } finally {
      setSyncing(false);
      refreshState();
    }
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      toast.error('Please enter both your Supabase URL and anon key first.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(supabaseUrl.trim(), supabaseKey.trim());
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      toast.success(res.message);
      saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    } else {
      toast.error(res.message);
    }
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setTestResult(null);
    toast.info('Disconnected from Supabase. Working in local offline storage.');
    refreshState();
  };

  const handlePullFromSupabase = async () => {
    if (!SupabaseService.isConfigured()) {
      toast.error('Please configure your Supabase credentials first.');
      return;
    }

    setSyncing(true);
    try {
      const counts = await SupabaseService.pullAll();
      reconcilePayments();
      toast.success(`Synced from Supabase: ${counts.patientsCount} patients, ${counts.visitsCount} visits, ${counts.paymentsCount} payments.`);
      try {
        window.dispatchEvent(new Event('nisiclinic_data_synced'));
      } catch {}
      refreshState();
    } catch (err) {
      toast.error(err.message || 'Failed to pull from Supabase.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePushToSupabase = async () => {
    if (!SupabaseService.isConfigured()) {
      toast.error('Please configure your Supabase credentials first.');
      return;
    }

    setPushing(true);
    try {
      await SupabaseService.pushAll();
      toast.success('Successfully uploaded local CRM data into Supabase!');
      refreshState();
    } catch (err) {
      toast.error(err.message || 'Failed to push to Supabase.');
    } finally {
      setPushing(false);
    }
  };

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSchema(true);
      toast.success('Supabase SQL Schema copied to clipboard!');
      setTimeout(() => setCopiedSchema(false), 3000);
    } catch {
      toast.error('Failed to copy. Please manually copy from the file supabase-schema.sql');
    }
  };

  const handleClearDemoData = () => {
    clearAllData();
    setShowClearModal(false);
    refreshState();
    toast.success('All records cleared! You now have a clean slate for real clinic records.');
    try {
      window.dispatchEvent(new Event('nisiclinic_data_synced'));
    } catch {}
  };

  const handleRestoreDemoData = () => {
    restoreDemoData();
    refreshState();
    toast.success('Demo sample data restored.');
    try {
      window.dispatchEvent(new Event('nisiclinic_data_synced'));
    } catch {}
  };

  const handleExportBackup = () => {
    const data = getAllDataForExport();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nisiclinic_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup file downloaded.');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = importAllDataFromJson(json);
        if (res.success) {
          reconcilePayments();
          toast.success('Backup restored successfully!');
          refreshState();
          try {
            window.dispatchEvent(new Event('nisiclinic_data_synced'));
          } catch {}
        } else {
          toast.error('Invalid backup file: ' + res.error);
        }
      } catch {
        toast.error('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isConfigured = SupabaseService.isConfigured();

  return (
    <div className="app-content animate-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Settings & Cloud Database</h1>
        <p className="page-subtitle">
          Connect your live Supabase (PostgreSQL) backend, manage database records, and control clinic backups.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        
        {/* Supabase Connection Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                background: isConfigured ? 'var(--color-success-light)' : 'var(--color-accent-light)',
                color: isConfigured ? 'var(--color-success)' : 'var(--color-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Server size={20} />
              </div>
              <div>
                <h3 className="card-title">Supabase (PostgreSQL) Cloud</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Production cloud database with real-time sync
                </p>
              </div>
            </div>

            <span className={`badge ${isConfigured ? 'badge-confirmed' : 'badge-no-show'}`}>
              {isConfigured ? 'Connected' : 'Local Storage'}
            </span>
          </div>

          <div className="card-body">
            {/* Project URL */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="supabase-url-input">
                Supabase Project URL
              </label>
              <input
                id="supabase-url-input"
                type="url"
                className="form-input"
                placeholder="https://your-project-id.supabase.co"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
              />
              <span className="form-hint">
                Found in your Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
              </span>
            </div>

            {/* Anon Key */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="supabase-key-input">
                Supabase Anon / Public API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="supabase-key-input"
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm"
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)' }}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="form-hint">
                Found in your Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon / public)
              </span>
            </div>

            {/* Test Connection Results Alert */}
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
                        {testResult.message}
                      </div>
                      {testResult.needsSchema && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', marginTop: '4px' }}>
                          💡 Please copy the SQL Schema below and run it in the Supabase SQL Editor.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} color="var(--color-error)" />
                    <div style={{ color: 'var(--color-error-text)' }}>{testResult.message}</div>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTestConnection}
                disabled={testing || !supabaseUrl || !supabaseKey}
              >
                <RefreshCw size={14} className={testing ? 'spin' : ''} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveConfig}
              >
                Save & Connect
              </button>

              {isConfigured && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleDisconnect}
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* Sync Tools when connected */}
            {isConfigured && (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)'
              }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                  Cloud Synchronization Tools
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                  Changes sync automatically in the background. You can also manually pull or push data anytime.
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handlePullFromSupabase}
                    disabled={syncing}
                    title="Pull latest patients and records from Supabase"
                  >
                    <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                    {syncing ? 'Syncing...' : 'Pull from Supabase'}
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handlePushToSupabase}
                    disabled={pushing}
                    title="Upload local offline records to Supabase"
                  >
                    <Cloud size={14} />
                    {pushing ? 'Uploading...' : 'Push Local to Supabase'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Database & Records Summary Card */}
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
                <h3 className="card-title">Database Records</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Current active data counts
                </p>
              </div>
            </div>

            <span className={`badge ${isDemo ? 'badge-waiting' : 'badge-completed'}`}>
              {isDemo ? 'Demo Mode' : 'Clean / Live Data'}
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
                Clean Slate for Real Clinic
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                Clear mock patients and start completely fresh for your real clinic.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowClearModal(true)}
                  id="clear-demo-data-btn"
                >
                  <Trash2 size={14} />
                  Clear All Data
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

      {/* Supabase SQL Migration Schema Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-light)', color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Terminal size={20} />
            </div>
            <div>
              <h3 className="card-title">Supabase SQL Schema & Migration Script</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Run this SQL script in your Supabase project to generate all tables, foreign keys, and indexes.
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleCopySchema}
            id="copy-supabase-schema-btn"
          >
            {copiedSchema ? <Check size={14} /> : <Copy size={14} />}
            {copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}
          </button>
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>1. Open Supabase</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Log into <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>supabase.com/dashboard</a> and open your project.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>2. SQL Editor</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                In the left sidebar, click <strong>SQL Editor</strong> &gt; <strong>New query</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>3. Paste & Run</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Click the <strong>Copy SQL Schema</strong> button above, paste it into the editor, and click <strong>Run</strong>.
              </p>
            </div>

            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>4. Connect CRM</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Copy your <strong>Project URL</strong> and <strong>Anon Key</strong> from Project Settings &gt; API, paste them above, and click <strong>Save & Connect</strong>.
              </p>
            </div>

          </div>

          {/* Collapsible Schema Preview */}
          <div style={{
            background: '#1E1E2E',
            color: '#CDD6F4',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '220px',
            overflowY: 'auto'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{SUPABASE_SCHEMA_SQL}</pre>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Clear Data */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear All Records?"
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
            Are you sure you want to clear all data?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            This will permanently remove all patients, visits, payments, and appointments. You will have a clean, blank CRM to begin registering real clinic patients.
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
              Yes, Clear All Data
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
