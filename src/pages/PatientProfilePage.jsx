import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Phone, MapPin, AlertTriangle, Calendar, FileText,
  CreditCard, ChevronRight, Plus, Clock, User,
  Heart, Edit, Trash2, X, AlertCircle, Save, Check, Pill,
  CheckCircle2, Zap, DollarSign
} from 'lucide-react';
import { PatientsService, VisitsService, PaymentsService, AppointmentsService, MedicinesService, reconcilePayments } from '../services/dataService';
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

  // Delete Patient State
  const [deletePatientModal, setDeletePatientModal] = useState(false);

  // Delete Payment State
  const [deletePaymentModal, setDeletePaymentModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  // Quick Settle / "Collected the rest of the amount" Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectVisitId, setCollectVisitId] = useState(null);
  const [collectMethod, setCollectMethod] = useState('Cash');
  const [collectNotes, setCollectNotes] = useState('Collected the rest of the amount');
  const [isCollecting, setIsCollecting] = useState(false);

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
  // 1-Click "Collected the rest of the amount" Handlers
  // -----------------------------------------------------------
  function openCollectBalanceModal(amount, visitId = null) {
    const num = Number(amount) || 0;
    if (num <= 0) return;
    setCollectAmount(num);
    setCollectVisitId(visitId);
    setCollectMethod('Cash');
    setCollectNotes(visitId ? 'Collected the rest of the amount for visit' : 'Collected the rest of the amount');
    setCollectModalOpen(true);
  }

  function handleConfirmCollectBalance() {
    if (!patient || collectAmount <= 0) return;
    setIsCollecting(true);
    try {
      PaymentsService.createWithCascade({
        patient_id: patient.patient_id,
        visit_id: collectVisitId || '',
        amount: collectAmount,
        payment_method: collectMethod,
        payment_date: new Date().toISOString().split('T')[0],
        notes: collectNotes || 'Collected the rest of the amount'
      });
      reconcilePayments();
      toast.success(`Collected ${formatCurrency(collectAmount)} via ${collectMethod}! Remaining balance is now settled.`);
      setCollectModalOpen(false);
      try {
        window.dispatchEvent(new Event('nisiclinic_data_synced'));
      } catch {}
      loadData();
    } catch (err) {
      toast.error('Failed to collect payment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCollecting(false);
    }
  }

  // -----------------------------------------------------------
  // Visit Edit Handlers
  // -----------------------------------------------------------
  function openEditVisit(visit) {
    setEditingVisit(visit);
    const allPayments = PaymentsService.getAll();
    const visitPayment = allPayments.find(p => p.visit_id === visit.visit_id);

    setEditVisitForm({
      visit_date: visit.visit_date || '',
      complaint: visit.complaint || '',
      diagnosis: visit.diagnosis || '',
      clinical_notes: visit.clinical_notes || '',
      treatment: visit.treatment || '',
      medicines: Array.isArray(visit.medicines) ? JSON.parse(JSON.stringify(visit.medicines)) : [],
      total_amount: (visit.total_amount !== undefined && visit.total_amount !== null && visit.total_amount !== '') ? visit.total_amount : '',
      amount_paid: (visit.amount_paid !== undefined && visit.amount_paid !== null && visit.amount_paid !== '') ? visit.amount_paid : '',
      payment_method: visit.payment_method || visitPayment?.payment_method || 'Cash',
      payment_notes: visitPayment?.notes || '',
      follow_up: !!visit.follow_up_date,
      follow_up_date: visit.follow_up_date || '',
      dentist: visit.created_by || 'Dr. Nisi'
    });
    setEditVisitModal(true);
  }

  function setFollowUpPreset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEditVisitForm(prev => ({
      ...prev,
      follow_up: true,
      follow_up_date: d.toISOString().split('T')[0]
    }));
  }

  function handleAddMedicine() {
    setEditVisitForm(prev => ({
      ...prev,
      medicines: [...prev.medicines, { name: '', dosage: '', instructions: '', qty: 1, medicine_id: '' }]
    }));
  }

  function handleUpdateMedicine(index, field, value) {
    setEditVisitForm(prev => {
      const updated = [...prev.medicines];
      const current = { ...updated[index], [field]: value };
      if (field === 'name') {
        const found = MedicinesService.getAll().find(m => m.name.toLowerCase() === value.trim().toLowerCase());
        if (found) {
          current.medicine_id = found.medicine_id;
          if (found.strength && !current.dosage) current.dosage = found.strength;
        }
      }
      updated[index] = current;
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
      payment_method: editVisitForm.payment_method,
      payment_notes: editVisitForm.payment_notes,
      created_by: editVisitForm.dentist || editingVisit.created_by || 'Dr. Nisi',
      follow_up_date: editVisitForm.follow_up ? editVisitForm.follow_up_date : ''
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
  // Patient Delete Handler
  // -----------------------------------------------------------
  function handleConfirmDeletePatient() {
    if (!patient) return;
    const pName = patient.name;
    PatientsService.delete(patient.patient_id);
    toast.success(`Patient "${pName}" and all associated records deleted.`);
    setDeletePatientModal(false);
    navigate('/patients');
  }

  // -----------------------------------------------------------
  // Payment Delete Handlers
  // -----------------------------------------------------------
  function promptDeletePayment(payment) {
    setPaymentToDelete(payment);
    setDeletePaymentModal(true);
  }

  function handleConfirmDeletePayment() {
    if (!paymentToDelete) return;
    PaymentsService.delete(paymentToDelete.payment_id);
    toast.success('Payment record deleted and balance recalculated.');
    setDeletePaymentModal(false);
    setPaymentToDelete(null);
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
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setDeletePatientModal(true)}
                  title="Delete Patient"
                  id="delete-patient-icon-btn"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-error)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <Trash2 size={16} />
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
            {outstanding > 0 && (
              <button
                className="btn btn-sm"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => openCollectBalanceModal(outstanding)}
                id="header-collect-rest-btn"
                title="Collect all remaining pending balance"
              >
                <CheckCircle2 size={15} /> Collected Rest ({formatCurrency(outstanding)})
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/visits/new?patient=${id}`)}>
              <FileText size={14} /> New Visit
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/appointments/new?patient=${id}`)}>
              <Calendar size={14} /> Appointment
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/payments/new?patient=${id}`)}>
              <CreditCard size={14} /> Payment
            </button>
            <button className="btn btn-secondary btn-sm" onClick={openEditPatient}>
              <Edit size={14} /> Edit Patient
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--color-error)', borderColor: '#FCA5A5' }}
              onClick={() => setDeletePatientModal(true)}
              id="delete-patient-profile-btn"
              title="Delete this patient"
            >
              <Trash2 size={14} /> Delete
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
          <div
            className="profile-stat"
            style={outstanding > 0 ? { cursor: 'pointer', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-md)' } : {}}
            onClick={() => outstanding > 0 && openCollectBalanceModal(outstanding)}
            title={outstanding > 0 ? "Click to collect remaining balance" : undefined}
          >
            <div className="profile-stat-value" style={{ color: outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {formatCurrency(outstanding)}
            </div>
            <div className="profile-stat-label">
              Outstanding {outstanding > 0 && <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '11px', marginLeft: '4px' }}>⚡ Settle</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Pending Balance Alert Banner */}
      {outstanding > 0 && (
        <div style={{
          margin: 'var(--space-4) 0',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, #FFFBEB 0%, #ECFDF5 100%)',
          border: '1px solid #FCD34D',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: 'var(--radius-full)',
              background: '#FEF3C7', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertCircle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
                Pending Balance Due: <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>{formatCurrency(outstanding)}</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Patient has an unpaid balance. Settle and record collection instantly with one click.
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              padding: '8px 16px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            onClick={() => openCollectBalanceModal(outstanding)}
            id="banner-collect-rest-btn"
          >
            <CheckCircle2 size={16} /> Collected the Rest of the Amount ({formatCurrency(outstanding)})
          </button>
        </div>
      )}

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

                    {/* Medicines Prescribed & Dispensed */}
                    {visit.medicines?.length > 0 && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Pill size={13} /> Medicines
                        </span>
                        <div className="timeline-content-value" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                          {visit.medicines.map((m, i) => (
                            <div key={i} style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border-light)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{m.name}</span>
                                {m.dosage && (
                                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px', fontSize: 'var(--font-size-xs)' }}>
                                    · {m.dosage}
                                  </span>
                                )}
                                {m.instructions && (
                                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                                    {m.instructions}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {m.qty && (
                                  <span style={{
                                    fontSize: '11px', fontWeight: 600,
                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                    background: 'var(--color-accent-light)', color: 'var(--color-accent)'
                                  }}>
                                    {m.qty} pcs
                                  </span>
                                )}
                                {m.medicine_id && (
                                  <span style={{
                                    fontSize: '10px', fontWeight: 600,
                                    padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                    background: 'var(--color-success-light)', color: 'var(--color-success-text)'
                                  }}>
                                    Stock
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Amount & Pending Balance */}
                    <div className="timeline-content-row">
                      <span className="timeline-content-label">Amount</span>
                      <span className="timeline-content-value">
                        {formatCurrency(visit.total_amount)}
                        {visit.balance > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{
                              color: 'var(--color-warning-text)',
                              background: 'var(--color-warning-light)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              marginLeft: '8px'
                            }}>
                              {formatCurrency(visit.balance)} pending
                            </span>
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: '2px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#ECFDF5',
                                color: '#059669',
                                border: '1px solid #A7F3D0',
                                borderRadius: 'var(--radius-sm)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                              onClick={() => openCollectBalanceModal(visit.balance, visit.visit_id)}
                              id={`collect-visit-balance-${visit.visit_id}`}
                              title="Collected the rest of the amount for this visit"
                            >
                              <CheckCircle2 size={12} /> Collected Rest ({formatCurrency(visit.balance)})
                            </button>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {outstanding > 0 && (
              <button
                className="btn btn-sm"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => openCollectBalanceModal(outstanding)}
                id="payments-tab-collect-rest-btn"
              >
                <CheckCircle2 size={14} /> Collected Rest ({formatCurrency(outstanding)})
              </button>
            )}
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
                      <th style={{ textAlign: 'right' }}>Action</th>
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
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => promptDeletePayment(p)}
                            title="Delete payment"
                            style={{ color: 'var(--color-text-tertiary)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-error)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
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
          {/* Patient banner inside modal */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: 'var(--color-accent-light)',
            borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-xs)'
          }}>
            <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
              Patient: {patient.name} ({patient.patient_id})
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              ID: {editingVisit?.visit_id}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Visit Date *</label>
              <input
                type="date"
                className="form-input"
                value={editVisitForm.visit_date}
                onChange={e => setEditVisitForm({ ...editVisitForm, visit_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attending Doctor / Dentist</label>
              <input
                type="text"
                className="form-input"
                value={editVisitForm.dentist || 'Dr. Nisi'}
                onChange={e => setEditVisitForm({ ...editVisitForm, dentist: e.target.value })}
                placeholder="Dr. Nisi"
              />
            </div>
          </div>

          {/* Follow-up Section with Presets */}
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: editVisitForm.follow_up ? 'var(--space-2)' : 0 }}>
              <label className="form-checkbox" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={editVisitForm.follow_up}
                  onChange={e => setEditVisitForm({ ...editVisitForm, follow_up: e.target.checked })}
                />
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Follow-up / Recall Required</span>
              </label>

              {editVisitForm.follow_up && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFollowUpPreset(7)}>+1 Wk</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFollowUpPreset(14)}>+2 Wk</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFollowUpPreset(30)}>+1 Mo</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFollowUpPreset(180)}>+6 Mo (Recall)</button>
                </div>
              )}
            </div>

            {editVisitForm.follow_up && (
              <input
                type="date"
                className="form-input"
                style={{ marginTop: 'var(--space-2)' }}
                value={editVisitForm.follow_up_date}
                onChange={e => setEditVisitForm({ ...editVisitForm, follow_up_date: e.target.value })}
              />
            )}
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
                      placeholder="Medicine name (from stock or custom)"
                      list="edit-modal-medicines"
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
                      placeholder="Instructions (e.g. 1 tab after food)"
                      value={m.instructions}
                      onChange={e => handleUpdateMedicine(idx, 'instructions', e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="1"
                      value={m.qty || 1}
                      onChange={e => handleUpdateMedicine(idx, 'qty', Number(e.target.value) || 1)}
                      style={{ width: '70px', flexShrink: 0 }}
                      title="Quantity dispensed"
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

            {/* Datalist for autocomplete */}
            <datalist id="edit-modal-medicines">
              {MedicinesService.getAll().map(med => (
                <option key={med.medicine_id} value={med.name}>
                  {med.name} ({med.strength ? `${med.strength}, ` : ''}Stock: {med.stock_qty})
                </option>
              ))}
            </datalist>
          </div>

          {/* Financials & Balance */}
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-5)'
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={15} /> Payment & Billing Details
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)'
            }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Total Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 2300"
                  className="form-input"
                  value={editVisitForm.total_amount}
                  onChange={e => setEditVisitForm({ ...editVisitForm, total_amount: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Amount Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 300"
                  className="form-input"
                  value={editVisitForm.amount_paid}
                  onChange={e => setEditVisitForm({ ...editVisitForm, amount_paid: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Balance Pending (₹)</label>
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

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-3)'
            }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Payment Method</label>
                <select
                  className="form-input"
                  value={editVisitForm.payment_method}
                  onChange={e => setEditVisitForm({ ...editVisitForm, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Payment Remark / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paid ₹300 advance, ₹2000 due next visit"
                  value={editVisitForm.payment_notes}
                  onChange={e => setEditVisitForm({ ...editVisitForm, payment_notes: e.target.value })}
                />
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--color-error)' }}
              onClick={() => {
                setEditPatientModal(false);
                setDeletePatientModal(true);
              }}
            >
              <Trash2 size={14} /> Delete Patient
            </button>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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

      {/* =========================================================
          MODAL 4: CONFIRM DELETE PATIENT
          ========================================================= */}
      <Modal
        isOpen={deletePatientModal}
        onClose={() => setDeletePatientModal(false)}
        title="Delete Patient Dossier?"
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: 'var(--radius-full)',
            background: 'var(--color-error-light)', color: 'var(--color-error)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <Trash2 size={26} />
          </div>

          <p style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-2)' }}>
            Permanently delete {patient?.name}?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            This will permanently remove <strong>{patient?.name}</strong> ({patient?.patient_id}) along with all associated history:
          </p>

          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
            textAlign: 'left',
            fontSize: 'var(--font-size-xs)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-2)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{visits.length}</div>
              <div style={{ color: 'var(--color-text-tertiary)' }}>Visits</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{payments.length}</div>
              <div style={{ color: 'var(--color-text-tertiary)' }}>Payments</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{appointments.length}</div>
              <div style={{ color: 'var(--color-text-tertiary)' }}>Appointments</div>
            </div>
          </div>

          <div style={{
            padding: '8px 12px',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 'var(--radius-md)',
            color: '#B91C1C',
            fontSize: 'var(--font-size-xs)',
            marginBottom: 'var(--space-5)',
            textAlign: 'left'
          }}>
            ⚠️ <strong>Warning:</strong> This action cannot be undone. All clinical notes, treatment records, prescriptions, and financial transactions will be deleted.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletePatientModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDeletePatient}
              id="confirm-delete-patient-btn"
            >
              Yes, Delete Patient & All Records
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 5: CONFIRM DELETE PAYMENT
          ========================================================= */}
      <Modal
        isOpen={deletePaymentModal}
        onClose={() => setDeletePaymentModal(false)}
        title="Delete Payment Record?"
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
            Delete this payment entry?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Payment of <strong>{formatCurrency(paymentToDelete?.amount)}</strong> collected on {formatDate(paymentToDelete?.payment_date)} ({paymentToDelete?.payment_method || 'Cash'}).
          </p>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', background: 'var(--color-warning-light)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-5)' }}>
            ℹ️ If this payment was linked to a visit, the outstanding balance on that visit will be adjusted automatically.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletePaymentModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDeletePayment}
              id="confirm-delete-payment-btn"
            >
              Yes, Delete Payment
            </button>
          </div>
        </div>
      </Modal>

      {/* 1-Click "Collected the rest of the amount" Modal */}
      <Modal
        isOpen={collectModalOpen}
        onClose={() => !isCollecting && setCollectModalOpen(false)}
        title="Collect Remaining Balance"
      >
        <div style={{ padding: 'var(--space-1) 0' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            textAlign: 'center',
            marginBottom: 'var(--space-5)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Amount to Collect
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-success)', margin: '4px 0' }}>
              {formatCurrency(collectAmount)}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Patient: <strong>{patient?.name}</strong> {patient?.phone ? `(${patient?.phone})` : ''}
            </div>
          </div>

          {/* Payment Method Quick Selector */}
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Payment Method
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCollectMethod(m)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-md)',
                    border: collectMethod === m ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
                    background: collectMethod === m ? 'var(--color-success-light)' : 'var(--color-surface)',
                    color: collectMethod === m ? 'var(--color-success)' : 'var(--color-text-primary)',
                    fontWeight: collectMethod === m ? 700 : 500,
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'center'
                  }}
                >
                  {m === 'Cash' && '💵 '}
                  {m === 'UPI' && '📱 '}
                  {m === 'Card' && '💳 '}
                  {m === 'Bank Transfer' && '🏦 '}
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
            <label className="form-label" htmlFor="collect-notes-input">
              Payment Note
            </label>
            <input
              id="collect-notes-input"
              type="text"
              className="form-input"
              value={collectNotes}
              onChange={e => setCollectNotes(e.target.value)}
              placeholder="e.g. Collected the rest of the amount"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCollectModalOpen(false)}
              disabled={isCollecting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                padding: '8px 20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                cursor: 'pointer'
              }}
              onClick={handleConfirmCollectBalance}
              disabled={isCollecting}
              id="confirm-collect-balance-btn"
            >
              <CheckCircle2 size={16} />
              {isCollecting ? 'Recording...' : `Collected Full ${formatCurrency(collectAmount)} Now`}
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
