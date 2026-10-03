import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PatientsService, VisitsService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Plus, X, Search } from 'lucide-react';

export default function NewVisitPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedPatient = searchParams.get('patient');

  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientSearch, setShowPatientSearch] = useState(!preselectedPatient);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({
    complaint: '',
    diagnosis: '',
    clinical_notes: '',
    treatment: '',
    medicines: [],
    follow_up: false,
    follow_up_date: '',
    total_amount: '',
    amount_paid: '',
    payment_method: 'Cash',
    visit_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (preselectedPatient) {
      const p = PatientsService.getById(preselectedPatient);
      if (p) {
        setSelectedPatient(p);
        setShowPatientSearch(false);
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
    setShowPatientSearch(false);
    setPatientSearch('');
    setPatientResults([]);
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addMedicine() {
    setForm(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', instructions: '' }]
    }));
  }

  function updateMedicine(index, field, value) {
    setForm(prev => {
      const meds = [...prev.medicines];
      meds[index] = { ...meds[index], [field]: value };
      return { ...prev, medicines: meds };
    });
  }

  function removeMedicine(index) {
    setForm(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  }

  const totalAmount = Number(form.total_amount) || 0;
  const amountPaid = Number(form.amount_paid) || 0;
  const balance = Math.max(0, totalAmount - amountPaid);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error('Please select a patient.');
      return;
    }

    if (!form.complaint.trim()) {
      toast.warning('Please enter the patient\'s complaint.');
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    try {
      VisitsService.create({
        patient_id: selectedPatient.patient_id,
        visit_date: form.visit_date,
        complaint: form.complaint,
        diagnosis: form.diagnosis,
        clinical_notes: form.clinical_notes,
        treatment: form.treatment,
        medicines: form.medicines.filter(m => m.name.trim()),
        follow_up_date: form.follow_up ? form.follow_up_date : '',
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_method: form.payment_method
      });

      toast.success('Visit saved successfully');
      navigate(`/patients/${selectedPatient.patient_id}`);
    } catch {
      toast.error('Something went wrong while saving the visit. Please try again.');
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
          <h1 className="page-title">New Visit</h1>
        </div>
        <p className="page-subtitle">Record the clinical details for this visit.</p>
      </div>

      <div style={{ maxWidth: '720px' }}>
        <form onSubmit={handleSubmit}>
          {/* Patient Selection */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header">
              <h3 className="card-title">Patient</h3>
              {selectedPatient && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                  setSelectedPatient(null);
                  setShowPatientSearch(true);
                }}>
                  Change
                </button>
              )}
            </div>
            <div className="card-body">
              {selectedPatient ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 'var(--font-size-sm)'
                  }}>
                    {selectedPatient.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {selectedPatient.phone} · {selectedPatient.patient_id}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search patient by name, phone, or ID..."
                    value={patientSearch}
                    onChange={e => handlePatientSearch(e.target.value)}
                    autoFocus
                  />
                  {patientResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      marginTop: '4px', background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-lg)', zIndex: 50, overflow: 'hidden'
                    }}>
                      {patientResults.map(p => (
                        <button
                          type="button"
                          key={p.patient_id}
                          onClick={() => selectPatient(p)}
                          style={{
                            width: '100%', padding: '10px 14px', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between',
                            borderBottom: '1px solid var(--color-border-light)',
                            background: 'none', cursor: 'pointer', textAlign: 'left',
                            fontSize: 'var(--font-size-base)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{p.name}</div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{p.phone}</div>
                          </div>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{p.patient_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clinical Details */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header">
              <h3 className="card-title">Clinical Details</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="visit-date">Visit Date</label>
                <input
                  id="visit-date"
                  type="date"
                  className="form-input"
                  value={form.visit_date}
                  onChange={e => updateField('visit_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="visit-complaint">Patient Problem / Complaint</label>
                <textarea
                  id="visit-complaint"
                  className="form-input"
                  placeholder="What is the patient complaining about?"
                  value={form.complaint}
                  onChange={e => updateField('complaint', e.target.value)}
                  rows={2}
                  style={{ minHeight: '70px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="visit-diagnosis">Diagnosis</label>
                <textarea
                  id="visit-diagnosis"
                  className="form-input"
                  placeholder="Your diagnosis"
                  value={form.diagnosis}
                  onChange={e => updateField('diagnosis', e.target.value)}
                  rows={2}
                  style={{ minHeight: '70px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="visit-notes">Clinical Notes</label>
                <textarea
                  id="visit-notes"
                  className="form-input"
                  placeholder="Additional clinical notes"
                  value={form.clinical_notes}
                  onChange={e => updateField('clinical_notes', e.target.value)}
                  rows={2}
                  style={{ minHeight: '60px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="visit-treatment">Treatment</label>
                <input
                  id="visit-treatment"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Composite filling, Scaling, Root Canal"
                  value={form.treatment}
                  onChange={e => updateField('treatment', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Medicines */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header">
              <h3 className="card-title">Medicines</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addMedicine}>
                <Plus size={14} /> Add Medicine
              </button>
            </div>
            <div className="card-body">
              {form.medicines.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: 'var(--space-4)',
                  color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)'
                }}>
                  No medicines added. Click "Add Medicine" to prescribe.
                </div>
              ) : (
                form.medicines.map((med, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-4)', background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)',
                    position: 'relative'
                  }}>
                    <button
                      type="button"
                      onClick={() => removeMedicine(i)}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-tertiary)', padding: '4px',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <X size={14} />
                    </button>
                    <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Medicine Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Paracetamol"
                          value={med.name}
                          onChange={e => updateMedicine(i, 'name', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Dosage</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 500mg"
                          value={med.dosage}
                          onChange={e => updateMedicine(i, 'dosage', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Instructions</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 1 tablet after food, twice daily for 3 days"
                        value={med.instructions}
                        onChange={e => updateMedicine(i, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Follow-up */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header">
              <h3 className="card-title">Follow-up</h3>
            </div>
            <div className="card-body">
              <label className="form-checkbox" style={{ marginBottom: 'var(--space-4)' }}>
                <input
                  type="checkbox"
                  checked={form.follow_up}
                  onChange={e => updateField('follow_up', e.target.checked)}
                />
                <span>Follow-up required</span>
              </label>
              {form.follow_up && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="visit-followup-date">Follow-up Date</label>
                  <input
                    id="visit-followup-date"
                    type="date"
                    className="form-input"
                    value={form.follow_up_date}
                    onChange={e => updateField('follow_up_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header">
              <h3 className="card-title">Payment</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="visit-amount">Treatment Amount (₹)</label>
                  <input
                    id="visit-amount"
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={form.total_amount}
                    onChange={e => updateField('total_amount', e.target.value)}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="visit-paid">Amount Paid (₹)</label>
                  <input
                    id="visit-paid"
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={form.amount_paid}
                    onChange={e => updateField('amount_paid', e.target.value)}
                    min="0"
                    max={totalAmount}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="visit-method">Payment Method</label>
                  <select
                    id="visit-method"
                    className="form-input"
                    value={form.payment_method}
                    onChange={e => updateField('payment_method', e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Remaining Balance</label>
                  <div style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: balance > 0 ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: 'var(--font-size-lg)',
                    color: balance > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving} id="save-visit-btn">
              {saving ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
