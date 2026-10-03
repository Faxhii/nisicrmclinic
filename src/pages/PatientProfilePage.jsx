import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, MapPin, AlertTriangle, Calendar, FileText,
  CreditCard, ChevronRight, Plus, Clock, User,
  Heart, Edit
} from 'lucide-react';
import { PatientsService, VisitsService, PaymentsService, AppointmentsService } from '../services/dataService';
import { formatCurrency, formatDate, formatTime, getInitials } from '../utils/helpers';

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  function loadData() {
    setLoading(true);
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
  const lastVisit = visits.length > 0 ? visits[0] : null;
  const today = new Date().toISOString().split('T')[0];
  const nextAppointment = appointments.find(a => a.date >= today && a.status !== 'Cancelled');
  const nextFollowUp = visits.find(v => v.follow_up_date && v.follow_up_date >= today);

  const canViewClinical = hasPermission('view_clinical_notes');

  return (
    <div className="app-content animate-in">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-header-top">
          <div className="profile-info">
            <div className="profile-avatar">{getInitials(patient.name)}</div>
            <div>
              <h1 className="profile-name">{patient.name}</h1>
              <div className="profile-meta">
                <span className="profile-meta-item">
                  <User size={13} /> {patient.patient_id}
                </span>
                {patient.age && (
                  <span className="profile-meta-item">{patient.age} yrs · {patient.gender || 'N/A'}</span>
                )}
                <span className="profile-meta-item">
                  <Phone size={13} /> {patient.phone}
                </span>
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
          </div>
        </div>

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
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="dashboard-grid">
          {/* Quick Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Info</h3>
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
                    <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

          {/* Recent Visit */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Most Recent Visit</h3>
            </div>
            <div className="card-body">
              {lastVisit ? (
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {formatDate(lastVisit.visit_date)}
                  </div>
                  {canViewClinical && (
                    <>
                      <InfoRow label="Complaint" value={lastVisit.complaint || '—'} />
                      <InfoRow label="Diagnosis" value={lastVisit.diagnosis || '—'} />
                    </>
                  )}
                  <InfoRow label="Treatment" value={lastVisit.treatment || '—'} />
                  {lastVisit.medicines?.length > 0 && (
                    <InfoRow
                      label="Medicine"
                      value={lastVisit.medicines.map(m => m.name).join(', ')}
                    />
                  )}
                  <InfoRow label="Amount" value={formatCurrency(lastVisit.total_amount)} />
                  {lastVisit.follow_up_date && (
                    <InfoRow label="Follow-up" value={formatDate(lastVisit.follow_up_date)} />
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <FileText className="empty-state-icon" />
                  <div className="empty-state-text">No visits recorded yet.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/visits/new?patient=${id}`)}>
                    Create First Visit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                    {canViewClinical && visit.complaint && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Complaint</span>
                        <span className="timeline-content-value">{visit.complaint}</span>
                      </div>
                    )}
                    {canViewClinical && visit.diagnosis && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Diagnosis</span>
                        <span className="timeline-content-value">{visit.diagnosis}</span>
                      </div>
                    )}
                    {visit.treatment && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Treatment</span>
                        <span className="timeline-content-value">{visit.treatment}</span>
                      </div>
                    )}
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
                    <div className="timeline-content-row">
                      <span className="timeline-content-label">Amount</span>
                      <span className="timeline-content-value">
                        {formatCurrency(visit.total_amount)}
                        {visit.balance > 0 && (
                          <span style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)', marginLeft: '8px' }}>
                            (₹{visit.balance} pending)
                          </span>
                        )}
                      </span>
                    </div>
                    {visit.follow_up_date && (
                      <div className="timeline-content-row">
                        <span className="timeline-content-label">Follow-up</span>
                        <span className="timeline-content-value">{formatDate(visit.follow_up_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          {/* Payment Summary */}
          <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="stat-card">
              <div className="stat-card-label">Total Treatment</div>
              <div className="stat-card-value">{formatCurrency(totalTreatment)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Total Paid</div>
              <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{formatCurrency(totalPaid)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Remaining Balance</div>
              <div className="stat-card-value" style={{ color: outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {formatCurrency(outstanding)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/payments/new?patient=${id}`)}>
              <Plus size={14} /> Record Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <CreditCard className="empty-state-icon" />
                <div className="empty-state-title">No payments recorded</div>
                <div className="empty-state-text">Payment history will appear here.</div>
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

      {activeTab === 'details' && (
        <div className="card">
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
                <span style={{ color: 'var(--color-error)' }}>{patient.allergies}</span>
              ) : '—'}
            />
            <InfoRow label="Medical Notes" value={patient.medical_notes || '—'} />
            <InfoRow label="Emergency Contact" value={patient.emergency_contact || '—'} />
            <InfoRow label="Registered" value={formatDate(patient.created_at?.split('T')[0])} />
          </div>
        </div>
      )}
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
        minWidth: '120px',
        flexShrink: 0
      }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  );
}
