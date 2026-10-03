import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { PatientsService, AppointmentsService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';

export default function NewAppointmentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedPatient = searchParams.get('patient');

  const [saving, setSaving] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    reason: '',
    status: 'Confirmed',
    notes: '',
    dentist: 'Dr. Nisi'
  });

  useEffect(() => {
    if (preselectedPatient) {
      const p = PatientsService.getById(preselectedPatient);
      if (p) setSelectedPatient(p);
    }
  }, [preselectedPatient]);

  function handlePatientSearch(q) {
    setPatientSearch(q);
    if (q.trim().length >= 2) {
      setPatientResults(PatientsService.search(q).slice(0, 5));
    } else {
      setPatientResults([]);
    }
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient.');
      return;
    }
    if (!form.date) {
      toast.warning('Please select a date.');
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    try {
      AppointmentsService.create({
        patient_id: selectedPatient.patient_id,
        ...form
      });
      toast.success('Appointment scheduled successfully');
      navigate('/appointments');
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setSaving(false);
  }

  return (
    <div className="app-content animate-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <button className="btn btn-icon btn-ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title">New Appointment</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '560px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Patient Selection */}
            <div className="form-group">
              <label className="form-label required">Patient</label>
              {selectedPatient ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3)', background: 'var(--color-accent-light)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {selectedPatient.phone}
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search patient..."
                    value={patientSearch}
                    onChange={e => handlePatientSearch(e.target.value)}
                    autoFocus
                  />
                  {patientResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      marginTop: '4px', background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-lg)', zIndex: 50
                    }}>
                      {patientResults.map(p => (
                        <button
                          type="button" key={p.patient_id}
                          onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]); }}
                          style={{
                            width: '100%', padding: '10px 14px', display: 'block',
                            borderBottom: '1px solid var(--color-border-light)',
                            background: 'none', cursor: 'pointer', textAlign: 'left'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{p.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="appt-date">Date</label>
                <input
                  id="appt-date" type="date" className="form-input"
                  value={form.date} onChange={e => updateField('date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="appt-time">Time</label>
                <input
                  id="appt-time" type="time" className="form-input"
                  value={form.time} onChange={e => updateField('time', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="appt-reason">Reason</label>
              <input
                id="appt-reason" type="text" className="form-input"
                placeholder="e.g. Tooth cleaning, Follow-up, Root canal"
                value={form.reason} onChange={e => updateField('reason', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="appt-status">Status</label>
              <select id="appt-status" className="form-input"
                value={form.status} onChange={e => updateField('status', e.target.value)}>
                <option value="Confirmed">Confirmed</option>
                <option value="Waiting">Waiting</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="appt-notes">Notes</label>
              <textarea
                id="appt-notes" className="form-input" placeholder="Optional notes"
                value={form.notes} onChange={e => updateField('notes', e.target.value)}
                rows={2} style={{ minHeight: '60px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving} id="save-appointment-btn">
                {saving ? 'Saving...' : 'Schedule Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
