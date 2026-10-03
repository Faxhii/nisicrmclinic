import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientsService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import { validateRequired, validatePhone } from '../utils/helpers';
import { ArrowLeft } from 'lucide-react';

export default function AddPatientPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '',
    date_of_birth: '',
    address: '',
    medical_notes: '',
    allergies: '',
    emergency_contact: ''
  });

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }

  function validate() {
    const errs = {};
    if (!validateRequired(form.name)) errs.name = 'Full name is required';
    if (!validateRequired(form.phone)) errs.phone = 'Phone number is required';
    else if (!validatePhone(form.phone)) errs.phone = 'Enter a valid 10-digit phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    await new Promise(r => setTimeout(r, 400));

    try {
      const patient = PatientsService.create(form);
      toast.success(`Patient "${form.name}" added successfully`);
      navigate(`/patients/${patient.patient_id}`);
    } catch {
      toast.error('Something went wrong while saving. Please try again.');
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
          <h1 className="page-title">New Patient</h1>
        </div>
        <p className="page-subtitle">Register a new patient. Only name and phone are required.</p>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Required */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                Required Information
              </h3>
              <div className="form-group">
                <label className="form-label required" htmlFor="patient-name">Full Name</label>
                <input
                  id="patient-name"
                  type="text"
                  className={`form-input ${errors.name ? 'form-input-error' : ''}`}
                  placeholder="e.g. Rahul Kumar"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  autoFocus
                />
                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="patient-phone">Phone Number</label>
                <input
                  id="patient-phone"
                  type="tel"
                  className={`form-input ${errors.phone ? 'form-input-error' : ''}`}
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  maxLength={10}
                />
                {errors.phone && <div className="form-error">{errors.phone}</div>}
              </div>
            </div>

            {/* Optional */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                Optional Information
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-age">Age</label>
                  <input
                    id="patient-age"
                    type="number"
                    className="form-input"
                    placeholder="e.g. 32"
                    value={form.age}
                    onChange={e => updateField('age', e.target.value)}
                    min="0" max="120"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-gender">Gender</label>
                  <select
                    id="patient-gender"
                    className="form-input"
                    value={form.gender}
                    onChange={e => updateField('gender', e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-dob">Date of Birth</label>
                <input
                  id="patient-dob"
                  type="date"
                  className="form-input"
                  value={form.date_of_birth}
                  onChange={e => updateField('date_of_birth', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-address">Address</label>
                <textarea
                  id="patient-address"
                  className="form-input"
                  placeholder="Enter address"
                  value={form.address}
                  onChange={e => updateField('address', e.target.value)}
                  rows={2}
                  style={{ minHeight: '60px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-allergies">Allergies</label>
                <input
                  id="patient-allergies"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Penicillin, Aspirin"
                  value={form.allergies}
                  onChange={e => updateField('allergies', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-notes">Medical Notes</label>
                <textarea
                  id="patient-notes"
                  className="form-input"
                  placeholder="Any relevant medical history"
                  value={form.medical_notes}
                  onChange={e => updateField('medical_notes', e.target.value)}
                  rows={2}
                  style={{ minHeight: '60px' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="patient-emergency">Emergency Contact</label>
                <input
                  id="patient-emergency"
                  type="tel"
                  className="form-input"
                  placeholder="Emergency contact number"
                  value={form.emergency_contact}
                  onChange={e => updateField('emergency_contact', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} id="save-patient-btn">
                {saving ? 'Saving...' : 'Save Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
