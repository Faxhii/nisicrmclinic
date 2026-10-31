import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ChevronRight, Users, Trash2, CheckCircle2 } from 'lucide-react';
import { PatientsService, VisitsService, AppointmentsService, PaymentsService, reconcilePayments } from '../services/dataService';
import { formatCurrency, formatDate, getInitials, debounce } from '../utils/helpers';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';

export default function PatientsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Quick Collect Rest Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedPatientToCollect, setSelectedPatientToCollect] = useState(null);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMethod, setCollectMethod] = useState('Cash');
  const [collectNotes, setCollectNotes] = useState('Collected the rest of the amount');
  const [isCollecting, setIsCollecting] = useState(false);

  useEffect(() => {
    loadPatients();
    const handleSync = () => loadPatients();
    window.addEventListener('nisiclinic_data_synced', handleSync);
    return () => window.removeEventListener('nisiclinic_data_synced', handleSync);
  }, []);

  function loadPatients() {
    reconcilePayments();
    setPatients(PatientsService.getAll().filter(p => !p.is_archived));
  }

  function promptDeletePatient(patient) {
    setPatientToDelete(patient);
    setDeleteModalOpen(true);
  }

  function handleConfirmDelete() {
    if (!patientToDelete) return;
    const name = patientToDelete.name;
    PatientsService.delete(patientToDelete.patient_id);
    toast.success(`Patient "${name}" and all associated records deleted.`);
    setDeleteModalOpen(false);
    setPatientToDelete(null);
    loadPatients();
  }

  function openQuickCollect(patient) {
    setSelectedPatientToCollect(patient);
    setCollectAmount(Number(patient.outstanding) || 0);
    setCollectMethod('Cash');
    setCollectNotes('Collected the rest of the amount');
    setCollectModalOpen(true);
  }

  function handleConfirmCollect() {
    if (!selectedPatientToCollect || collectAmount <= 0) return;
    setIsCollecting(true);
    try {
      PaymentsService.createWithCascade({
        patient_id: selectedPatientToCollect.patient_id,
        amount: collectAmount,
        payment_method: collectMethod,
        payment_date: new Date().toISOString().split('T')[0],
        notes: collectNotes || 'Collected the rest of the amount'
      });
      reconcilePayments();
      toast.success(`Collected ${formatCurrency(collectAmount)} via ${collectMethod} from ${selectedPatientToCollect.name}! Balance settled.`);
      setCollectModalOpen(false);
      setSelectedPatientToCollect(null);
      try {
        window.dispatchEvent(new Event('nisiclinic_data_synced'));
      } catch {}
      loadPatients();
    } catch (err) {
      toast.error('Failed to collect: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCollecting(false);
    }
  }

  const enrichedPatients = useMemo(() => {
    return patients.map(p => ({
      ...p,
      outstanding: PatientsService.getOutstandingBalance(p.patient_id),
      lastVisit: PatientsService.getLastVisitDate(p.patient_id)
    }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let list = enrichedPatients;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.patient_id.toLowerCase().includes(q)
      );
    }

    // Filters
    const today = new Date().toISOString().split('T')[0];
    switch (activeFilter) {
      case 'today': {
        const todayAppts = AppointmentsService.getTodaysAppointments();
        const todayPatientIds = new Set(todayAppts.map(a => a.patient_id));
        list = list.filter(p => todayPatientIds.has(p.patient_id));
        break;
      }
      case 'recent': {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        list = list.filter(p => p.lastVisit && p.lastVisit >= weekAgo);
        break;
      }
      case 'followup': {
        const visits = VisitsService.getAll();
        const followUpPatientIds = new Set(
          visits.filter(v => v.follow_up_date && v.follow_up_date >= today).map(v => v.patient_id)
        );
        list = list.filter(p => followUpPatientIds.has(p.patient_id));
        break;
      }
      case 'pending': {
        list = list.filter(p => p.outstanding > 0);
        break;
      }
    }

    return list;
  }, [enrichedPatients, searchQuery, activeFilter]);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'recent', label: 'Recent' },
    { key: 'followup', label: 'Follow-up' },
    { key: 'pending', label: 'Pending Payment' },
  ];

  return (
    <div className="app-content animate-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Patients</h1>
            <p className="page-subtitle">{patients.length} registered patients</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/patients/new')} id="add-patient-btn">
            <UserPlus size={16} />
            New Patient
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div className="search-container" style={{ marginBottom: 'var(--space-4)' }}>
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, phone, or patient ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            id="patient-search"
          />
        </div>
        <div className="filter-pills">
          {filters.map(f => (
            <button
              key={f.key}
              className={`filter-pill ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient List */}
      {filteredPatients.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <div className="empty-state-title">No patients found</div>
            <div className="empty-state-text">
              {searchQuery ? 'No patients match your search.' : 'Add your first patient to get started.'}
            </div>
            {!searchQuery && (
              <button className="btn btn-primary" onClick={() => navigate('/patients/new')}>
                Add Patient
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Desktop table */}
          <div className="table-container" style={{ display: 'var(--table-display, block)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Age</th>
                  <th>Last Visit</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => (
                  <tr key={p.patient_id} className="clickable" onClick={() => navigate(`/patients/${p.patient_id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, fontSize: 'var(--font-size-sm)', flexShrink: 0
                        }}>
                          {getInitials(p.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            {p.patient_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.phone}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.age || '—'}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(p.lastVisit)}</td>
                    <td>
                      {p.outstanding > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-warning">{formatCurrency(p.outstanding)}</span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: '#ECFDF5',
                              color: '#059669',
                              border: '1px solid #A7F3D0',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickCollect(p);
                            }}
                            title="1-click collect remaining balance"
                          >
                            <CheckCircle2 size={11} /> Collect Rest
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge-success">Paid</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Delete Patient"
                          onClick={(e) => {
                            e.stopPropagation();
                            promptDeletePatient(p);
                          }}
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-error)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={16} color="var(--color-text-tertiary)" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Patient Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Patient Record?"
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

          <p style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-2)' }}>
            Permanently delete {patientToDelete?.name}?
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Are you sure you want to delete <strong>{patientToDelete?.name}</strong> ({patientToDelete?.patient_id})?
          </p>

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
            ⚠️ <strong>Warning:</strong> This will also permanently remove all associated clinical visits, treatment records, prescriptions, and payments for this patient. This action cannot be undone.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDelete}
              id="confirm-delete-patient-list-btn"
            >
              Yes, Delete Patient & All Records
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
              Patient: <strong>{selectedPatientToCollect?.name}</strong> {selectedPatientToCollect?.phone ? `(${selectedPatientToCollect?.phone})` : ''}
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
            <label className="form-label" htmlFor="patient-collect-notes-input">
              Payment Note
            </label>
            <input
              id="patient-collect-notes-input"
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
              onClick={handleConfirmCollect}
              disabled={isCollecting}
              id="confirm-collect-patients-btn"
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
