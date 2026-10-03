import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, MoreHorizontal } from 'lucide-react';

const items = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/appointments', icon: Calendar, label: 'Appointments' },
  { path: '/patients', icon: Users, label: 'Patients' },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-items">
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
            end={item.path === '/'}
          >
            <item.icon className="icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
