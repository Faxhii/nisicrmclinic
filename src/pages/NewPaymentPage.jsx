import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { PatientsService, PaymentsService, VisitsService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/helpers';

export default function NewPaymentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedPatient = searchParams.get('patient');

  const [saving, setSaving] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [outstanding, setOutstanding] = useState(0);

  const [form, setForm] = useState({
    amount: '',
    payment_method: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (preselectedPatient) {
      const p = PatientsService.getById(preselectedPatient);
      if (p) {
        setSelectedPatient(p);
        setOutstanding(PatientsService.getOutstandingBalance(p.patient_id));
      }
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

  function selectPatient(p) {
    setSelectedPatient(p);
    setPatientSearch('');
    setPatientResults([]);
    setOutstanding(PatientsService.getOutstandingBalance(p.patient_id));
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPatient) { toast.error('Please select a patient.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.warning('Please enter a valid amount.'); return; }

    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    try {
      // Find the latest visit with balance for this patient to associate
      const visits = VisitsService.getByPatient(selectedPatient.patient_id);
      const visitWithBalance = visits.find(v => (Number(v.balance) || 0) > 0);

      PaymentsService.create({
        patient_id: selectedPatient.patient_id,
        visit_id: visitWithBalance?.visit_id || '',
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        notes: form.notes
      });

      // Update the visit balance if associated
      if (visitWithBalance) {
        const newPaid = (Number(visitWithBalance.amount_paid) || 0) + Number(form.amount);
        const newBalance = Math.max(0, (Number(visitWithBalance.total_amount) || 0) - newPaid);
        VisitsService.update(visitWithBalance.visit_id, {
          amount_paid: newPaid,
          balance: newBalance
        });
      }

      toast.success(`Payment of ${formatCurrency(form.amount)} recorded`);
      navigate(`/patients/${selectedPatient.patient_id}`);
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
          <h1 className="page-title">Record Payment</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '520px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Patient */}
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
                      Outstanding: <strong style={{ color: outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {formatCurrency(outstanding)}
                      </strong>
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search className="search-icon" />
                  <input type="text" className="search-input" placeholder="Search patient..."
                    value={patientSearch} onChange={e => handlePatientSearch(e.target.value)} autoFocus />
                  {patientResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)', zIndex: 50
                    }}>
                      {patientResults.map(p => (
                        <button type="button" key={p.patient_id}
                          onClick={() => selectPatient(p)}
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

            <div className="form-group">
              <label className="form-label required" htmlFor="pay-amount">Amount (₹)</label>
              <input id="pay-amount" type="number" className="form-input"
                placeholder="0" value={form.amount}
                onChange={e => updateField('amount', e.target.value)} min="0" autoFocus={!!selectedPatient} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="pay-method">Payment Method</label>
                <select id="pay-method" className="form-input"
                  value={form.payment_method} onChange={e => updateField('payment_method', e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-date">Date</label>
                <input id="pay-date" type="date" className="form-input"
                  value={form.payment_date} onChange={e => updateField('payment_date', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-notes">Notes</label>
              <input id="pay-notes" type="text" className="form-input"
                placeholder="e.g. Partial payment for crown fitting"
                value={form.notes} onChange={e => updateField('notes', e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving} id="save-payment-btn">
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
