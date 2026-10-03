import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, Calendar, ChevronRight, Search } from 'lucide-react';
import { AppointmentsService, PatientsService } from '../services/dataService';
import { formatDate, formatTime, getStatusBadgeClass, getInitials } from '../utils/helpers';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [activeView, setActiveView] = useState('today');
  const [editingAppt, setEditingAppt] = useState(null);

  useEffect(() => { loadAppointments(); }, []);

  function loadAppointments() {
    setAppointments(AppointmentsService.getAll());
  }

  const today = new Date().toISOString().split('T')[0];

  const filteredAppointments = useMemo(() => {
    switch (activeView) {
      case 'today':
        return appointments.filter(a => a.date === today);
      case 'week':
        return AppointmentsService.getThisWeek();
      case 'upcoming':
        return appointments.filter(a => a.date >= today && a.status !== 'Cancelled');
      case 'all':
      default:
        return appointments;
    }
  }, [appointments, activeView, today]);

  function handleStatusChange(apptId, newStatus) {
    AppointmentsService.update(apptId, { status: newStatus });
    loadAppointments();
    toast.success(`Appointment ${newStatus.toLowerCase()}`);
  }

  return (
    <div className="app-content animate-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Appointments</h1>
            <p className="page-subtitle">{filteredAppointments.length} appointments</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/appointments/new')} id="new-appointment-btn">
            <CalendarPlus size={16} />
            New Appointment
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="filter-pills" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'all', label: 'All' },
        ].map(v => (
          <button
            key={v.key}
            className={`filter-pill ${activeView === v.key ? 'active' : ''}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Calendar className="empty-state-icon" />
            <div className="empty-state-title">No appointments found</div>
            <div className="empty-state-text">
              {activeView === 'today'
                ? 'No appointments scheduled for today.'
                : 'No appointments match the selected view.'}
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/appointments/new')}>
              Schedule Appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map(apt => {
                  const patient = PatientsService.getById(apt.patient_id);
                  return (
                    <tr key={apt.appointment_id}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                          {formatTime(apt.time)}
                        </span>
                      </td>
                      <td>
                        <div
                          className="clickable"
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                          onClick={() => patient && navigate(`/patients/${patient.patient_id}`)}
                        >
                          <div style={{
                            width: '30px', height: '30px', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: 'var(--font-size-xs)', flexShrink: 0
                          }}>
                            {getInitials(patient?.name || '?')}
                          </div>
                          <span style={{ fontWeight: 500 }}>{patient?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{apt.reason || '—'}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(apt.date)}</td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(apt.status)}`}>{apt.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          {apt.status === 'Confirmed' && (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleStatusChange(apt.appointment_id, 'Waiting')}
                            >
                              Check In
                            </button>
                          )}
                          {apt.status === 'Waiting' && (
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ color: 'var(--status-in-treatment)' }}
                              onClick={() => handleStatusChange(apt.appointment_id, 'In Treatment')}
                            >
                              Start
                            </button>
                          )}
                          {(apt.status === 'In Treatment' || apt.status === 'Waiting') && (
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => handleStatusChange(apt.appointment_id, 'Completed')}
                            >
                              Complete
                            </button>
                          )}
                          {apt.status !== 'Completed' && apt.status !== 'Cancelled' && (
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ color: 'var(--color-error)' }}
                              onClick={() => handleStatusChange(apt.appointment_id, 'Cancelled')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
