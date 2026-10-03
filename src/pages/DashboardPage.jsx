import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Users, CreditCard, Clock, UserPlus,
  CalendarPlus, FileText, DollarSign, Bell,
  ChevronRight, Activity
} from 'lucide-react';
import {
  DashboardService, AppointmentsService, FollowUpsService, PatientsService
} from '../services/dataService';
import {
  formatCurrency, formatDate, formatTime, getGreeting,
  getTodayFormatted, getStatusBadgeClass, getInitials
} from '../utils/helpers';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setStats(DashboardService.getStats());
    setTodayAppts(AppointmentsService.getTodaysAppointments());
    setFollowUps(FollowUpsService.getTodaysFollowUps());
    setRecentPatients(DashboardService.getRecentPatients(5));
  }

  if (!stats) return <div className="app-content"><LoadingSkeleton /></div>;

  return (
    <div className="app-content animate-in">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'Doctor'}.</h1>
        <p>{getTodayFormatted()}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon={<Calendar size={18} />}
          iconBg="var(--color-accent-light)"
          iconColor="var(--color-accent)"
          label="Today's Appointments"
          value={stats.todaysAppointments}
          sub={`${stats.completedToday} completed · ${stats.waitingToday} waiting`}
        />
        <StatCard
          icon={<Activity size={18} />}
          iconBg="#F5F3FF"
          iconColor="#8B5CF6"
          label="In Treatment"
          value={stats.inTreatment}
          sub={`${stats.completedToday} completed today`}
        />
        <StatCard
          icon={<DollarSign size={18} />}
          iconBg="var(--color-success-light)"
          iconColor="var(--color-success)"
          label="Today's Revenue"
          value={formatCurrency(stats.todaysRevenue)}
          sub="Collected today"
        />
        <StatCard
          icon={<CreditCard size={18} />}
          iconBg="var(--color-warning-light)"
          iconColor="var(--color-warning)"
          label="Pending Payments"
          value={formatCurrency(stats.pendingPayments)}
          sub="Outstanding balance"
        />
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="quick-actions">
            <button className="quick-action-btn" onClick={() => navigate('/patients/new')}>
              <div className="quick-action-icon" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                <UserPlus size={18} />
              </div>
              New Patient
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/appointments/new')}>
              <div className="quick-action-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
                <CalendarPlus size={18} />
              </div>
              New Appointment
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/visits/new')}>
              <div className="quick-action-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                <FileText size={18} />
              </div>
              New Visit
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/payments/new')}>
              <div className="quick-action-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                <DollarSign size={18} />
              </div>
              Record Payment
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/follow-ups')}>
              <div className="quick-action-icon" style={{ background: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                <Bell size={18} />
              </div>
              Follow-ups
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="dashboard-grid">
        {/* Today's Appointments */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Today's Appointments</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/appointments')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-2) 0' }}>
            {todayAppts.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <Calendar className="empty-state-icon" />
                <div className="empty-state-title">No appointments today</div>
                <div className="empty-state-text">Schedule appointments to see them here.</div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/appointments/new')}>
                  Schedule Appointment
                </button>
              </div>
            ) : (
              todayAppts.map(apt => {
                const patient = PatientsService.getById(apt.patient_id);
                return (
                  <div
                    key={apt.appointment_id}
                    className="appointment-item"
                    onClick={() => patient && navigate(`/patients/${patient.patient_id}`)}
                  >
                    <div className="appointment-time">{formatTime(apt.time)}</div>
                    <div className="appointment-details">
                      <div className="appointment-patient">{patient?.name || 'Unknown'}</div>
                      <div className="appointment-reason">{apt.reason}</div>
                    </div>
                    <span className={`badge ${getStatusBadgeClass(apt.status)}`}>{apt.status}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Follow-ups Today */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Follow-ups Today</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/follow-ups')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-2) 0' }}>
            {followUps.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <Clock className="empty-state-icon" />
                <div className="empty-state-title">No follow-ups today</div>
                <div className="empty-state-text">Follow-ups from visits will appear here.</div>
              </div>
            ) : (
              followUps.map(fu => (
                <div
                  key={fu.visit_id}
                  className="appointment-item"
                  onClick={() => navigate(`/patients/${fu.patient_id}`)}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 'var(--font-size-sm)', flexShrink: 0
                  }}>
                    {getInitials(fu.patient_name)}
                  </div>
                  <div className="appointment-details">
                    <div className="appointment-patient">{fu.patient_name}</div>
                    <div className="appointment-reason">
                      {fu.treatment || fu.complaint || 'Follow-up'}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/patients/${fu.patient_id}`);
                  }}>
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Patients */}
        <div className="card dashboard-full">
          <div className="card-header">
            <h3 className="card-title">Recent Patients</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patients')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th>Last Visit</th>
                    <th>Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentPatients.map(p => (
                    <tr key={p.patient_id} className="clickable" onClick={() => navigate(`/patients/${p.patient_id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: 'var(--font-size-xs)', flexShrink: 0
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
                      <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(p.lastVisit)}</td>
                      <td>
                        {p.outstanding > 0 ? (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                            {formatCurrency(p.outstanding)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success)' }}>Paid</span>
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
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="skeleton skeleton-title" style={{ width: '250px', marginBottom: '24px' }} />
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '14px' }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: '200px', borderRadius: '14px' }} />
    </div>
  );
}
