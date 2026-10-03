import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Phone, MapPin, AlertTriangle, Calendar, FileText,
  CreditCard, ChevronRight, Plus, Clock, User,
  Heart, Edit, Trash2, X, AlertCircle, Save, Check
} from 'lucide-react';
import { PatientsService, VisitsService, PaymentsService, AppointmentsService, reconcilePayments } from '../services/dataService';
import { formatCurrency, formatDate, formatTime, getInitials } from '../utils/helpers';
import Modal from '../components/Modal';

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasPermission } = useAuth();

  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Edit Visit State
  const [editVisitModal, setEditVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [editVisitForm, setEditVisitForm] = useState({
    visit_date: '',
    complaint: '',
    diagnosis: '',
    clinical_notes: '',
    treatment: '',
    medicines: [],
    total_amount: 0,
    amount_paid: 0,
    follow_up_date: ''
  });

  // Delete Visit Confirmation State
  const [deleteVisitModal, setDeleteVisitModal] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState(null);

  // Edit Patient State
  const [editPatientModal, setEditPatientModal] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '',
    date_of_birth: '',
    address: '',
    allergies: '',
    medical_notes: '',
    emergency_contact: ''
  });

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('nisiclinic_data_synced', handleSync);
    return () => window.removeEventListener('nisiclinic_data_synced', handleSync);
  }, [id]);

  function loadData() {
    setLoading(true);
    reconcilePayments();
    const p = PatientsService.getById(id);
    if (!p) {
      navigate('/patients');
      return;
    }
    setPatient(p);
    setVisits(VisitsService.getByPatient(id));
    setPayments(PaymentsService.getByPatient(id));
    setAppointments(AppointmentsService.getByPatient(id));
    setLoading(false);
  }

  // -----------------------------------------------------------
  // Visit Edit Handlers
  // -----------------------------------------------------------
  function openEditVisit(visit) {
    setEditingVisit(visit);
    setEditVisitForm({
      visit_date: visit.visit_date || '',
      complaint: visit.complaint || '',
      diagnosis: visit.diagnosis || '',
      clinical_notes: visit.clinical_notes || '',
      treatment: visit.treatment || '',
      medicines: Array.isArray(visit.medicines) ? JSON.parse(JSON.stringify(visit.medicines)) : [],
      total_amount: visit.total_amount ?? 0,
      amount_paid: visit.amount_paid ?? 0,
      follow_up_date: visit.follow_up_date || ''
    });
    setEditVisitModal(true);
  }

  function handleAddMedicine() {
    setEditVisitForm(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', instructions: '' }]
    }));
  }

  function handleUpdateMedicine(index, field, value) {
    setEditVisitForm(prev => {
      const updated = [...prev.medicines];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, medicines: updated };
    });
  }

  function handleRemoveMedicine(index) {
    setEditVisitForm(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  }

  function handleSaveVisitEdit(e) {
    e.preventDefault();
    if (!editingVisit) return;

    const total = Number(editVisitForm.total_amount) || 0;
    const paid = Number(editVisitForm.amount_paid) || 0;
    const balance = Math.max(0, total - paid);

    VisitsService.update(editingVisit.visit_id, {
      visit_date: editVisitForm.visit_date,
      complaint: editVisitForm.complaint,
      diagnosis: editVisitForm.diagnosis,
      clinical_notes: editVisitForm.clinical_notes,
      treatment: editVisitForm.treatment,
      medicines: editVisitForm.medicines.filter(m => m.name && m.name.trim()),
      total_amount: total,
      amount_paid: paid,
      balance: balance,
      follow_up_date: editVisitForm.follow_up_date
    });

    toast.success('Visit details updated successfully!');
    setEditVisitModal(false);
    setEditingVisit(null);
    loadData();
    try {
      window.dispatchEvent(new Event('nisiclinic_data_synced'));
    } catch {}
  }

  function promptDeleteVisit(visit) {
    setVisitToDelete(visit);
    setDeleteVisitModal(true);
  }

  function handleConfirmDeleteVisit() {
    if (!visitToDelete) return;
    VisitsService.delete(visitToDelete.visit_id);
    toast.success('Visit record deleted.');
    setDeleteVisitModal(false);
    setVisitToDelete(null);
    if (editVisitModal) setEditVisitModal(false);
    loadData();
  }

  // -----------------------------------------------------------
  // Patient Edit Handlers
  // -----------------------------------------------------------
  function openEditPatient() {
    setEditPatientForm({
      name: patient.name || '',
      phone: patient.phone || '',
      age: patient.age || '',
      gender: patient.gender || 'Female',
      date_of_birth: patient.date_of_birth || '',
      address: patient.address || '',
      allergies: patient.allergies || '',
      medical_notes: patient.medical_notes || '',
      emergency_contact: patient.emergency_contact || ''
    });
    setEditPatientModal(true);
  }

  function handleSavePatientEdit(e) {
    e.preventDefault();
    if (!editPatientForm.name.trim() || !editPatientForm.phone.trim()) {
      toast.error('Patient Name and Phone number are required.');
      return;
    }

    PatientsService.update(patient.patient_id, {
      name: editPatientForm.name.trim(),
      phone: editPatientForm.phone.trim(),
      age: editPatientForm.age,
      gender: editPatientForm.gender,
      date_of_birth: editPatientForm.date_of_birth,
      address: editPatientForm.address,
      allergies: editPatientForm.allergies,
      medical_notes: editPatientForm.medical_notes,
      emergency_contact: editPatientForm.emergency_contact
    });

    toast.success('Patient details updated successfully!');
    setEditPatientModal(false);
    loadData();
  }

  if (loading || !patient) {
    return (
      <div className="app-content">
        <div className="skeleton skeleton-title" style={{ width: '200px' }} />
        <div className="skeleton" style={{ height: '200px', borderRadius: '14px', marginTop: '16px' }} />
      </div>
    );
  }

  const outstanding = visits.reduce((sum, v) => sum + (Number(v.balance) || 0), 0);
  const totalTreatment = visits.reduce((sum, v) => sum + (Number(v.total_amount) || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const lastVisit = visits[0];
  const upcomingAppts = appointments
    .filter(a => a.date >= new Date().toISOString().split('T')[0] && a.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextAppointment = upcomingAppts[0];
  const nextFollowUp = visits.find(v => v.follow_up_date && v.follow_up_date >= new Date().toISOString().split('T')[0]);

  const canViewClinical = hasPermission('view_clinical_notes');

  return (
    <div className="app-content animate-in">
      {/* Patient Dossier Header */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="profile-header-top">
          <div className="profile-identity">
            <div className="profile-avatar">
              {getInitials(patient.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h1 className="profile-name">{patient.name}</h1>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={openEditPatient}
                  title="Edit Patient Details"
                  id="edit-patient-btn"
                >
                  <Edit size={16} />
                </button>
              </div>
              <div className="profile-meta">
                <span>{patient.patient_id}</span>
                {patient.age && <span>{patient.age} yrs</span>}
                {patient.gender && <span>{patient.gender}</span>}
                {patient.phone && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} /> {patient.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => navigate(`/visits/new?patient=${id}`)}>
              <FileText size={15} /> New Visit
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/appointments/new?patient=${id}`)}>
              <Calendar size={15} /> Appointment
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/payments/new?patient=${id}`)}>
              <CreditCard size={15} /> Payment
            </button>
            <button className="btn btn-secondary" onClick={openEditPatient}>
              <Edit size={15} /> Edit Patient
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value">{visits.length}</div>
            <div className="profile-stat-label">Total Visits</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value">{formatCurrency(totalTreatment)}</div>
            <div className="profile-stat-label">Total Treatment</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value" style={{ color: 'var(--color-success)' }}>
              {formatCurrency(totalPaid)}
            </div>
            <div className="profile-stat-label">Total Paid</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value" style={{ color: outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {formatCurrency(outstanding)}
            </div>
            <div className="profile-stat-label">Outstanding</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'visits', 'payments', 'details'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            id={`tab-${tab}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'visits' && visits.length > 0 && ` (${visits.length})`}
          </button>
        ))}
      </div>

      {/* =========================================================
          Tab 1: Overview
          ========================================================= */}
      {activeTab === 'overview' && (
        <div className="dashboard-grid">
          {/* Quick Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Info</h3>
              <button className="btn btn-ghost btn-sm" onClick={openEditPatient}>
                <Edit size={13} /> Edit
              </button>
            </div>
            <div className="card-body">
              <InfoRow label="Last Visit" value={lastVisit ? formatDate(lastVisit.visit_date) : 'No visits yet'} />
              <InfoRow label="Last Treatment" value={lastVisit?.treatment || '—'} />
              <InfoRow
                label="Next Appointment"
                value={nextAppointment ? `${formatDate(nextAppointment.date)} at ${formatTime(nextAppointment.time)}` : 'None scheduled'}
              />
              <InfoRow
                label="Next Follow-up"
                value={nextFollowUp ? formatDate(nextFollowUp.follow_up_date) : 'None'}
              />
              {patient.allergies && (
                <InfoRow
                  label="Allergies"
                  value={
                    <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <AlertTriangle size={13} /> {patient.allergies}
                    </span>
                  }
                />
              )}
              {patient.medical_notes && (
                <InfoRow label="Medical Notes" value={patient.medical_notes} />
              )}
            </div>
          </div>

          {/* Last Visit Details */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Latest Visit Summary</h3>
              {lastVisit && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEditVisit(lastVisit)}
                >
                  <Edit size={13} /> Edit Visit
                </button>
              )}
            </div>
            <div className="card-body">
              {lastVisit ? (
                <>
                  <InfoRow label="Date" value={formatDate(lastVisit.visit_date)} />
                  {canViewClinical && <InfoRow label="Complaint" value={lastVisit.complaint || '—'} />}
                  {canViewClinical && <InfoRow label="Diagnosis" value={lastVisit.diagnosis || '—'} />}
                  <InfoRow label="Treatment" value={lastVisit.treatment || '—'} />
                  {lastVisit.medicines?.length > 0 && (
                    <InfoRow
                      label="Prescriptions"
                      value={lastVisit.medicines.map(m => m.name + (m.dosage ? ` (${m.dosage})` : '')).join(', ')}
                    />
                  )}
                  <InfoRow
                    label="Payment"
                    value={
                      <span>
                        {formatCurrency(lastVisit.total_amount)}
                        {lastVisit.balance > 0 && (
                          <span style={{ color: 'var(--color-warning)', marginLeft: '8px', fontWeight: 600 }}>
                            ({formatCurrency(lastVisit.balance)} pending)
                          </span>
                        )}
                      </span>
                    }
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-secondary)' }}>
                  <p style={{ marginBottom: 'var(--space-3)' }}>No visits recorded yet.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/visits/new?patient=${id}`)}>
                    Create First Visit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          Tab 2: Visits (With Edit & Delete Buttons)
          ========================================================= */}
      {activeTab === 'visits' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/visits/new?patient=${id}`)}>
              <Plus size={14} /> New Visit
            </button>
          </div>

          {visits.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <FileText className="empty-state-icon" />
                <div className="empty-state-title">No visits recorded</div>
                <div className="empty-state-text">Record the first visit to build the patient timeline.</div>
                <button className="btn btn-primary" onClick={() => navigate(`/visits/new?patient=${id}`)}>
                  Create Visit
                </button>
              </div>
            </div>
          ) : (
            <div className="timeline">
              {visits.map(visit => (
                <div key={visit.visit_id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-date">{formatDate(visit.visit_date)}</div>
                  <div className="timeline-content">

                    {/* Visit Header with EDIT & DELETE Actions */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-3)',
                      paddingBottom: 'var(--space-2)',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {visit.treatment ? (visit.treatment.length > 50 ? visit.treatment.substring(0, 50) + '...' : visit.treatment) : 'Clinical Consultation'}
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 10px', fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => openEditVisit(visit)}
                          id={`edit-visit-${visit.visit_id}`}
                          title="Edit this visit's notes, diagnosis, or medicines"
                        >
                          <Edit size={13} /> Edit Visit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 8px', color: 'var(--color-error)' }}
                          onClick={() => promptDeleteVisit(visit)}
                          title="Delete visit"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Complaint */}
                    {canViewClinical && visit.complaint && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Complaint</span>
                        <span className="timeline-content-value">{visit.complaint}</span>
                      </div>
                    )}

                    {/* Diagnosis */}
                    {canViewClinical && visit.diagnosis && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Diagnosis</span>
                        <span className="timeline-content-value" style={{ fontWeight: 500 }}>{visit.diagnosis}</span>
                      </div>
                    )}

                    {/* Clinical Notes */}
                    {canViewClinical && visit.clinical_notes && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Clinical Notes</span>
                        <span className="timeline-content-value" style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {visit.clinical_notes}
                        </span>
                      </div>
                    )}

                    {/* Treatment */}
                    {visit.treatment && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Treatment</span>
                        <span className="timeline-content-value">{visit.treatment}</span>
                      </div>
                    )}

                    {/* Medicines */}
                    {visit.medicines?.length > 0 && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Medicine</span>
                        <span className="timeline-content-value">
                          {visit.medicines.map((m, i) => (
                            <div key={i} style={{ marginBottom: i < visit.medicines.length - 1 ? '4px' : 0 }}>
                              <strong>{m.name}</strong>
                              {m.dosage && ` — ${m.dosage}`}
                              {m.instructions && (
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                  {m.instructions}
                                </div>
                              )}
                            </div>
                          ))}
                        </span>
                      </div>
                    )}

                    {/* Amount & Pending Balance */}
                    <div className="timeline-content-row">
                      <span className="timeline-content-label">Amount</span>
                      <span className="timeline-content-value">
                        {formatCurrency(visit.total_amount)}
                        {visit.balance > 0 ? (
                          <span style={{
                            color: 'var(--color-warning-text)',
                            background: 'var(--color-warning-light)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            marginLeft: '8px'
                          }}>
                            ₹{visit.balance} pending
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)', marginLeft: '8px' }}>
                            ✓ Paid
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Follow-up */}
                    {visit.follow_up_date && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Follow-up</span>
                        <span className="timeline-content-value" style={{ color: 'var(--color-info)' }}>
                          {formatDate(visit.follow_up_date)}
                        </span>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          Tab 3: Payments
          ========================================================= */}
      {activeTab === 'payments' && (
        <div>
          <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="stat-card">
              <div className="stat-card-label">Total Billed</div>
              <div className="stat-card-value">{formatCurrency(totalTreatment)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Total Collected</div>
              <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{formatCurrency(totalPaid)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Outstanding Due</div>
              <div className="stat-card-value" style={{ color: outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {formatCurrency(outstanding)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/payments/new?patient=${id}`)}>
              <CreditCard size={14} /> Record Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <CreditCard className="empty-state-icon" />
                <div className="empty-state-title">No payments recorded</div>
                <div className="empty-state-text">Payments collected from this patient will appear here.</div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.payment_id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-success-text)' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td>
                          <span className="badge badge-confirmed">{p.payment_method}</span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          Tab 4: Details (With Edit Button)
          ========================================================= */}
      {activeTab === 'details' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Patient Profile & Medical History</h3>
            <button className="btn btn-secondary btn-sm" onClick={openEditPatient}>
              <Edit size={14} /> Edit Details
            </button>
          </div>
          <div className="card-body">
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Patient ID" value={patient.patient_id} />
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Age" value={patient.age || '—'} />
            <InfoRow label="Gender" value={patient.gender || '—'} />
            <InfoRow label="Date of Birth" value={patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'} />
            <InfoRow label="Address" value={patient.address || '—'} />
            <InfoRow
              label="Allergies"
              value={patient.allergies ? (
                <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{patient.allergies}</span>
              ) : 'None reported'}
            />
            <InfoRow label="Medical Notes" value={patient.medical_notes || 'None'} />
            <InfoRow label="Emergency Contact" value={patient.emergency_contact || '—'} />
            <InfoRow label="Registered On" value={formatDate(patient.created_at?.split('T')[0])} />
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 1: EDIT VISIT MODAL
          ========================================================= */}
      <Modal
        isOpen={editVisitModal}
        onClose={() => setEditVisitModal(false)}
        title="Edit Visit Details"
        size="lg"
      >
        <form onSubmit={handleSaveVisitEdit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Visit Date</label>
              <input
                type="date"
                className="form-input"
                value={editVisitForm.visit_date}
                onChange={e => setEditVisitForm({ ...editVisitForm, visit_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Follow-up Date</label>
              <input
                type="date"
                className="form-input"
                value={editVisitForm.follow_up_date}
                onChange={e => setEditVisitForm({ ...editVisitForm, follow_up_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Chief Complaint</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Toothache, sensitivity, swelling"
              value={editVisitForm.complaint}
              onChange={e => setEditVisitForm({ ...editVisitForm, complaint: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Diagnosis</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dental caries, Periapical abscess"
              value={editVisitForm.diagnosis}
              onChange={e => setEditVisitForm({ ...editVisitForm, diagnosis: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Clinical Examination & Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Detailed doctor findings, tooth numbers, X-ray observations..."
              value={editVisitForm.clinical_notes}
              onChange={e => setEditVisitForm({ ...editVisitForm, clinical_notes: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Treatment Provided</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Composite filling, Root canal step 1, Scaling..."
              value={editVisitForm.treatment}
              onChange={e => setEditVisitForm({ ...editVisitForm, treatment: e.target.value })}
            />
          </div>

          {/* Medicines Dynamic Editor */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Prescribed Medicines</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddMedicine}
              >
                <Plus size={13} /> Add Drug
              </button>
            </div>

            {editVisitForm.medicines.length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                No medicines prescribed for this visit. Click "+ Add Drug" to add.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {editVisitForm.medicines.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Medicine name"
                      value={m.name}
                      onChange={e => handleUpdateMedicine(idx, 'name', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Dosage (e.g. 500mg)"
                      value={m.dosage}
                      onChange={e => handleUpdateMedicine(idx, 'dosage', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Instructions (e.g. 1 tab after food 3x daily)"
                      value={m.instructions}
                      onChange={e => handleUpdateMedicine(idx, 'instructions', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleRemoveMedicine(idx)}
                      style={{ color: 'var(--color-error)' }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financials & Balance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)'
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Total Fee (₹)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={editVisitForm.total_amount}
                onChange={e => setEditVisitForm({ ...editVisitForm, total_amount: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Amount Paid (₹)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={editVisitForm.amount_paid}
                onChange={e => setEditVisitForm({ ...editVisitForm, amount_paid: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Balance Pending (₹)</label>
              <div style={{
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                fontWeight: 700,
                color: (Number(editVisitForm.total_amount) - Number(editVisitForm.amount_paid)) > 0 ? 'var(--color-warning-text)' : 'var(--color-success)',
                border: '1px solid var(--color-border)'
              }}>
                {formatCurrency(Math.max(0, Number(editVisitForm.total_amount) - Number(editVisitForm.amount_paid)))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => promptDeleteVisit(editingVisit)}
            >
              <Trash2 size={14} /> Delete Visit
            </button>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditVisitModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                id="save-visit-edit-btn"
              >
                <Save size={15} /> Save Changes
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 2: EDIT PATIENT DETAILS MODAL
          ========================================================= */}
      <Modal
        isOpen={editPatientModal}
        onClose={() => setEditPatientModal(false)}
        title="Edit Patient Details"
        size="lg"
      >
        <form onSubmit={handleSavePatientEdit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={editPatientForm.name}
                onChange={e => setEditPatientForm({ ...editPatientForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                className="form-input"
                value={editPatientForm.phone}
                onChange={e => setEditPatientForm({ ...editPatientForm, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                className="form-input"
                placeholder="Years"
                value={editPatientForm.age}
                onChange={e => setEditPatientForm({ ...editPatientForm, age: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-input"
                value={editPatientForm.gender}
                onChange={e => setEditPatientForm({ ...editPatientForm, gender: e.target.value })}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={editPatientForm.date_of_birth}
                onChange={e => setEditPatientForm({ ...editPatientForm, date_of_birth: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Address / Location</label>
            <input
              type="text"
              className="form-input"
              placeholder="City, locality, or address"
              value={editPatientForm.address}
              onChange={e => setEditPatientForm({ ...editPatientForm, address: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" style={{ color: 'var(--color-error)' }}>
              Allergies (Medical Alert)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Penicillin, Sulfa, Latex (Leave blank if none)"
              value={editPatientForm.allergies}
              onChange={e => setEditPatientForm({ ...editPatientForm, allergies: e.target.value })}
              style={{ borderColor: editPatientForm.allergies ? 'var(--color-error)' : 'var(--color-border)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Medical History / Notes</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Diabetic Type 2, Hypertension, on blood thinners..."
              value={editPatientForm.medical_notes}
              onChange={e => setEditPatientForm({ ...editPatientForm, medical_notes: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
            <label className="form-label">Emergency Contact Phone</label>
            <input
              type="tel"
              className="form-input"
              placeholder="Family / Guardian contact"
              value={editPatientForm.emergency_contact}
              onChange={e => setEditPatientForm({ ...editPatientForm, emergency_contact: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditPatientModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="save-patient-edit-btn"
            >
              <Save size={15} /> Save Patient Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 3: CONFIRM DELETE VISIT
          ========================================================= */}
      <Modal
        isOpen={deleteVisitModal}
        onClose={() => setDeleteVisitModal(false)}
        title="Delete Visit Record?"
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius-full)',
            background: 'var(--color-error-light)', color: 'var(--color-error)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <Trash2 size={24} />
          </div>

          <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-2)' }}>
            Are you sure you want to delete this visit?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
            This will permanently remove the clinical notes and treatment record for {formatDate(visitToDelete?.visit_date)}.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setDeleteVisitModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleConfirmDeleteVisit}
              id="confirm-delete-visit-btn"
            >
              Yes, Delete Visit
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--color-border-light)'
    }}>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
        fontWeight: 500,
        minWidth: '130px',
        flexShrink: 0
      }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', flex: 1 }}>
        {value}
      </span>
    </div>
  );
}
