import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CreditCard, Clock, Users, Calendar,
  LogOut, Settings, FileText, Search, UserPlus
} from 'lucide-react';

export default function MorePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const items = [
    { icon: Settings, label: 'Google Sheets & Settings', path: '/settings', color: 'var(--color-accent)' },
    { icon: CreditCard, label: 'Payments', path: '/payments', color: 'var(--color-success)' },
    { icon: Clock, label: 'Follow-ups', path: '/follow-ups', color: 'var(--color-info)' },
    { icon: UserPlus, label: 'New Patient', path: '/patients/new', color: 'var(--color-accent)' },
    { icon: FileText, label: 'New Visit', path: '/visits/new', color: '#8B5CF6' },
    { icon: Calendar, label: 'New Appointment', path: '/appointments/new', color: 'var(--color-warning)' },
    { icon: CreditCard, label: 'Record Payment', path: '/payments/new', color: 'var(--color-success)' },
  ];

  return (
    <div className="app-content animate-in">
      <div className="page-header">
        <h1 className="page-title">More</h1>
      </div>

      {/* User Card */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent-light)', color: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 'var(--font-size-md)'
            }}>
              {user?.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{user?.name}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ padding: 'var(--space-2) 0' }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.path)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                background: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 'var(--font-size-base)', fontWeight: 500,
                color: 'var(--color-text-primary)',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                background: `${item.color}15`, color: item.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <item.icon size={16} />
              </div>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="card">
        <button
          onClick={logout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'none', cursor: 'pointer',
            fontSize: 'var(--font-size-base)', fontWeight: 500,
            color: 'var(--color-error)'
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}
