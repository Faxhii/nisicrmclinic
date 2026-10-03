import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { reconcilePayments } from '../services/dataService';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Reconcile any missing visit payments immediately
    reconcilePayments();

    // If Google Sheets is configured, auto-pull on launch to stay up to date with other devices
    if (GoogleSheetsService.isConfigured()) {
      GoogleSheetsService.pullFromSheet()
        .then(() => {
          reconcilePayments();
        })
        .catch(err => {
          console.warn('Initial cloud sync notice:', err);
        });
    }

    // Auto-refresh when tab is focused (throttled to at most once per 30s)
    let lastSync = Date.now();
    const handleFocus = () => {
      if (Date.now() - lastSync > 30000 && GoogleSheetsService.isConfigured()) {
        lastSync = Date.now();
        GoogleSheetsService.pullFromSheet()
          .then(() => {
            reconcilePayments();
          })
          .catch(err => console.warn('Focus sync notice:', err));
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} />
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
