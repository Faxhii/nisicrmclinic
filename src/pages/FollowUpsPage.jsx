import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import { FollowUpsService } from '../services/dataService';
import { formatDate, getInitials } from '../utils/helpers';

export default function FollowUpsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('today');
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState([]);

  useEffect(() => {
    setTodayFollowUps(FollowUpsService.getTodaysFollowUps());
    setUpcomingFollowUps(FollowUpsService.getUpcomingFollowUps());
    setOverdueFollowUps(FollowUpsService.getOverdueFollowUps());
  }, []);

  const currentList = activeTab === 'today' ? todayFollowUps
    : activeTab === 'upcoming' ? upcomingFollowUps
    : overdueFollowUps;

  return (
    <div className="app-content animate-in">
      <div className="page-header">
        <h1 className="page-title">Follow-ups</h1>
        <p className="page-subtitle">
          {todayFollowUps.length} today · {overdueFollowUps.length} overdue · {upcomingFollowUps.length} upcoming
        </p>
      </div>

      <div className="filter-pills" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          { key: 'today', label: `Today (${todayFollowUps.length})` },
          { key: 'overdue', label: `Overdue (${overdueFollowUps.length})` },
          { key: 'upcoming', label: `Upcoming (${upcomingFollowUps.length})` },
        ].map(v => (
          <button
            key={v.key}
            className={`filter-pill ${activeTab === v.key ? 'active' : ''}`}
            onClick={() => setActiveTab(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Clock className="empty-state-icon" />
            <div className="empty-state-title">No follow-ups</div>
            <div className="empty-state-text">
              {activeTab === 'today'
                ? 'No follow-ups scheduled for today.'
                : activeTab === 'overdue'
                ? 'No overdue follow-ups. Great!'
                : 'No upcoming follow-ups.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ padding: 'var(--space-2) 0' }}>
            {currentList.map(fu => (
              <div
                key={fu.visit_id}
                className="appointment-item"
                onClick={() => navigate(`/patients/${fu.patient_id}`)}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-full)',
                  background: activeTab === 'overdue' ? 'var(--color-error-light)' : 'var(--color-accent-light)',
                  color: activeTab === 'overdue' ? 'var(--color-error)' : 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 'var(--font-size-sm)', flexShrink: 0
                }}>
                  {getInitials(fu.patient_name)}
                </div>
                <div className="appointment-details" style={{ flex: 1 }}>
                  <div className="appointment-patient">{fu.patient_name}</div>
                  <div className="appointment-reason">
                    {fu.treatment || fu.complaint || 'Follow-up'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    color: activeTab === 'overdue' ? 'var(--color-error)' : 'var(--color-text-secondary)'
                  }}>
                    {formatDate(fu.follow_up_date)}
                  </div>
                  {fu.patient_phone && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {fu.patient_phone}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} color="var(--color-text-tertiary)" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
