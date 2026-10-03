import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, CreditCard,
  Clock, LogOut, Search, Menu, X, Settings
} from 'lucide-react';
import { getInitials } from '../utils/helpers';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'view_dashboard' },
  { path: '/patients', icon: Users, label: 'Patients', permission: 'view_patients' },
  { path: '/appointments', icon: Calendar, label: 'Appointments', permission: 'view_appointments' },
  { path: '/payments', icon: CreditCard, label: 'Payments', permission: 'view_payments' },
  { path: '/follow-ups', icon: Clock, label: 'Follow-ups', permission: 'view_dashboard' },
  { path: '/settings', icon: Settings, label: 'Google Sheets & Sync', permission: 'view_dashboard' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const filteredNav = navItems.filter(item => hasPermission(item.permission));

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">N</div>
          <div>
            <div className="sidebar-brand-text">NisiClinic</div>
            <div className="sidebar-brand-sub">Dental CRM</div>
          </div>
          <button
            className="btn btn-icon btn-ghost"
            onClick={onClose}
            style={{ marginLeft: 'auto', display: 'none' }}
            id="sidebar-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Menu</div>
            {filteredNav.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
                end={item.path === '/'}
              >
                <item.icon className="icon" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {getInitials(user?.name || 'U')}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role" style={{ textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            onClick={logout}
            title="Sign out"
            id="logout-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
