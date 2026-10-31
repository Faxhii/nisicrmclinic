import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { SupabaseService } from '../services/supabaseService';
import { reconcilePayments } from '../services/dataService';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Reconcile and fix any payment discrepancies immediately
    reconcilePayments();

    // If Supabase is configured, auto-pull on launch to stay in sync with cloud database
    if (SupabaseService.isConfigured()) {
      SupabaseService.pullAll()
        .then(() => {
          reconcilePayments();
        })
        .catch(err => {
          console.warn('Initial Supabase sync notice:', err);
        });

      // Subscribe to Realtime Postgres Changes
      SupabaseService.subscribeRealtime();
    }

    // Auto-refresh when tab is focused (throttled to at most once per 30s)
    let lastSync = Date.now();
    const handleFocus = () => {
      if (Date.now() - lastSync > 30000 && SupabaseService.isConfigured()) {
        lastSync = Date.now();
        SupabaseService.pullAll()
          .then(() => {
            reconcilePayments();
          })
          .catch(err => console.warn('Focus sync notice:', err));
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      SupabaseService.unsubscribeRealtime();
    };
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
