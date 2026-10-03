import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ChevronRight, Users } from 'lucide-react';
import { PatientsService, VisitsService, AppointmentsService } from '../services/dataService';
import { formatCurrency, formatDate, getInitials, debounce } from '../utils/helpers';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadPatients();
  }, []);

  function loadPatients() {
    setPatients(PatientsService.getAll().filter(p => !p.is_archived));
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
                        <span className="badge badge-warning">{formatCurrency(p.outstanding)}</span>
                      ) : (
                        <span className="badge badge-success">Paid</span>
                      )}
                    </td>
                    <td>
                      <ChevronRight size={16} color="var(--color-text-tertiary)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
