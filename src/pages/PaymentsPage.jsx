import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Plus, DollarSign, TrendingUp, AlertCircle,
  Calendar, CheckCircle2, Clock, ArrowUpRight, Search,
  PieChart, BarChart3, ChevronRight, Filter
} from 'lucide-react';
import { PaymentsService, PatientsService, VisitsService } from '../services/dataService';
import { formatCurrency, formatDate, formatDateShort, getInitials } from '../utils/helpers';

export default function PaymentsPage() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);

  // Active view tabs: 'received' (Transaction history) or 'pending' (Needs to get)
  const [activeTab, setActiveTab] = useState('received');
  // Filters for received payments: 'all' | 'today' | 'week' | 'upi' | 'cash' | 'card'
  const [receivedFilter, setReceivedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setPayments(PaymentsService.getAll());
    setVisits(VisitsService.getAll());
    setPatients(PatientsService.getAll());
  }

  const today = new Date().toISOString().split('T')[0];

  // -------------------------------------------------------------
  // Financial Totals & KPIs
  // -------------------------------------------------------------
  const totalReceived = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const totalPending = useMemo(() => {
    return visits.reduce((sum, v) => sum + (Number(v.balance) || 0), 0);
  }, [visits]);

  const totalBilled = totalReceived + totalPending;

  const collectionRate = totalBilled > 0
    ? Math.min(100, Math.round((totalReceived / totalBilled) * 100))
    : (totalReceived > 0 ? 100 : 0);

  const todayReceived = useMemo(() => {
    return payments
      .filter(p => p.payment_date === today)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments, today]);

  const weekReceived = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    return payments
      .filter(p => p.payment_date >= weekAgo)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  // -------------------------------------------------------------
  // Pending Receivables ("Needs to Get")
  // -------------------------------------------------------------
  const pendingVisits = useMemo(() => {
    const list = visits
      .filter(v => Number(v.balance) > 0)
      .map(v => {
        const patient = PatientsService.getById(v.patient_id);
        return {
          ...v,
          patientName: patient?.name || 'Unknown Patient',
          patientPhone: patient?.phone || '',
          patientObj: patient
        };
      })
      .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(v =>
      v.patientName.toLowerCase().includes(q) ||
      v.patientPhone.includes(q) ||
      (v.treatment || '').toLowerCase().includes(q)
    );
  }, [visits, searchQuery]);

  // -------------------------------------------------------------
  // Filtered Received Payments
  // -------------------------------------------------------------
  const filteredPayments = useMemo(() => {
    let list = payments;

    // Filter by timeframe or payment method
    switch (receivedFilter) {
      case 'today':
        list = list.filter(p => p.payment_date === today);
        break;
      case 'week': {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        list = list.filter(p => p.payment_date >= weekAgo);
        break;
      }
      case 'upi':
        list = list.filter(p => (p.payment_method || '').toLowerCase() === 'upi');
        break;
      case 'cash':
        list = list.filter(p => (p.payment_method || '').toLowerCase() === 'cash');
        break;
      case 'card':
        list = list.filter(p => (p.payment_method || '').toLowerCase() === 'card');
        break;
      default:
        break;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const patient = PatientsService.getById(p.patient_id);
        return (
          (patient?.name || '').toLowerCase().includes(q) ||
          (patient?.phone || '').includes(q) ||
          (p.notes || '').toLowerCase().includes(q) ||
          (p.payment_method || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [payments, receivedFilter, today, searchQuery]);

  // -------------------------------------------------------------
  // 7-Day Inflow Graph Data
  // -------------------------------------------------------------
  const last7DaysData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Yest' : formatDateShort(dateStr);

      const received = payments
        .filter(p => p.payment_date === dateStr)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const pending = visits
        .filter(v => v.visit_date === dateStr)
        .reduce((sum, v) => sum + (Number(v.balance) || 0), 0);

      days.push({
        dateStr,
        dayLabel,
        received,
        pending,
        total: received + pending
      });
    }

    const maxVal = Math.max(...days.map(d => Math.max(d.received, d.pending)), 500);
    return { days, maxVal };
  }, [payments, visits]);

  // -------------------------------------------------------------
  // Payment Methods Breakdown
  // -------------------------------------------------------------
  const methodStats = useMemo(() => {
    const map = { UPI: 0, Cash: 0, Card: 0, Other: 0 };
    payments.forEach(p => {
      const m = (p.payment_method || 'Cash').toUpperCase();
      if (m.includes('UPI') || m.includes('ONLINE')) map.UPI += Number(p.amount) || 0;
      else if (m.includes('CASH')) map.Cash += Number(p.amount) || 0;
      else if (m.includes('CARD')) map.Card += Number(p.amount) || 0;
      else map.Other += Number(p.amount) || 0;
    });

    const total = (map.UPI + map.Cash + map.Card + map.Other) || 1;
    return [
      { name: 'UPI', amount: map.UPI, pct: Math.round((map.UPI / total) * 100), color: '#4F46E5' },
      { name: 'Cash', amount: map.Cash, pct: Math.round((map.Cash / total) * 100), color: '#22C55E' },
      { name: 'Card', amount: map.Card, pct: Math.round((map.Card / total) * 100), color: '#F59E0B' },
      ...(map.Other > 0 ? [{ name: 'Other', amount: map.Other, pct: Math.round((map.Other / total) * 100), color: '#8B5CF6' }] : [])
    ];
  }, [payments]);

  return (
    <div className="app-content animate-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Payments & Receivables</h1>
            <p className="page-subtitle">
              Track collected revenue, cash flow trends, and outstanding patient balances.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/payments/new')}
            id="new-payment-btn"
          >
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      {/* =========================================================
          1. Financial KPI Summary Cards
          ========================================================= */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        
        {/* Money Received */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Money Received</div>
            <div className="stat-card-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-success-text)' }}>
            {formatCurrency(totalReceived)}
          </div>
          <div className="stat-card-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {formatCurrency(todayReceived)}
            </span> collected today · {payments.length} payments
          </div>
        </div>

        {/* Needs to Get (Pending Balance) */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Needs to Get (Pending)</div>
            <div className="stat-card-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: totalPending > 0 ? 'var(--color-warning-text)' : 'var(--color-text-secondary)' }}>
            {formatCurrency(totalPending)}
          </div>
          <div className="stat-card-sub">
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {pendingVisits.length}
            </span> {pendingVisits.length === 1 ? 'patient has' : 'patients have'} pending dues
          </div>
        </div>

        {/* Total Billed / Treatment Value */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Total Value Billed</div>
            <div className="stat-card-icon" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-card-value">
            {formatCurrency(totalBilled)}
          </div>
          <div className="stat-card-sub">
            Across {visits.length} clinical visits
          </div>
        </div>

        {/* Collection Efficiency Rate */}
        <div className="stat-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Collection Rate</div>
            <div className="stat-card-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
              <PieChart size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#8B5CF6' }}>
            {collectionRate}%
          </div>
          <div className="stat-card-sub">
            {collectionRate >= 80 ? '✓ Healthy cash flow' : 'Action needed on pending dues'}
          </div>
        </div>

      </div>

      {/* =========================================================
          2. Visual Graphs: Cash vs Pending & Daily Trend
          ========================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-6)',
        marginBottom: 'var(--space-6)'
      }}>

        {/* Graph 1: Received vs. Needs to Get Breakdown Meter */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Money Inflow vs. Pending Dues</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Comparison of collected cash vs. outstanding receivables
              </p>
            </div>
            <span className={`badge ${totalPending === 0 ? 'badge-completed' : 'badge-waiting'}`}>
              {totalPending === 0 ? 'Fully Collected' : `${collectionRate}% Collected`}
            </span>
          </div>

          <div className="card-body">
            {/* Visual Dual Progress Bar */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{
                height: '24px',
                width: '100%',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-border-light)',
                overflow: 'hidden',
                display: 'flex',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
              }}>
                <div
                  style={{
                    width: `${totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #10B981, #059669)',
                    height: '100%',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  title={`Received: ${formatCurrency(totalReceived)}`}
                />
                <div
                  style={{
                    width: `${totalBilled > 0 ? (totalPending / totalBilled) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                    height: '100%',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  title={`Needs to Get: ${formatCurrency(totalPending)}`}
                />
              </div>

              {/* Bar Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>
                  ● Received ({totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0}%)
                </span>
                <span style={{ color: 'var(--color-warning-text)', fontWeight: 600 }}>
                  ● Needs to Get ({totalBilled > 0 ? Math.round((totalPending / totalBilled) * 100) : 0}%)
                </span>
              </div>
            </div>

            {/* Detailed Row Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-success-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #BBF7D0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: 'var(--color-success)'
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-success-text)' }}>
                      Money Received
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success-text)', opacity: 0.85 }}>
                      Collected from patients
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-success-text)' }}>
                  {formatCurrency(totalReceived)}
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-warning-light)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #FDE68A'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: 'var(--color-warning)'
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning-text)' }}>
                      Needs to Get (Pending)
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', opacity: 0.85 }}>
                      Unpaid visit balances
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-warning-text)' }}>
                  {formatCurrency(totalPending)}
                </div>
              </div>

            </div>

            {/* Payment Method distribution */}
            {methodStats.some(m => m.amount > 0) && (
              <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-light)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  PAYMENT METHODS SPLIT
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {methodStats.map(m => m.amount > 0 && (
                    <div key={m.name} style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.color }} />
                      <span style={{ fontWeight: 600 }}>{m.name}:</span>
                      <span>{formatCurrency(m.amount)}</span>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>({m.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Graph 2: Last 7 Days Financial Flow (Bar Chart) */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">7-Day Daily Revenue Trend</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Daily incoming cash vs. pending treatment amounts
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--color-success)' }} /> Received
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-warning)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--color-warning)' }} /> Pending
              </span>
            </div>
          </div>

          <div className="card-body">
            {/* SVG Interactive Bar Chart */}
            <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', paddingBottom: '24px', position: 'relative' }}>
              
              {/* Background grid lines */}
              <div style={{ position: 'absolute', inset: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.15 }}>
                <div style={{ borderBottom: '1px dashed var(--color-text-secondary)' }} />
                <div style={{ borderBottom: '1px dashed var(--color-text-secondary)' }} />
                <div style={{ borderBottom: '1px dashed var(--color-text-secondary)' }} />
              </div>

              {last7DaysData.days.map((day, idx) => {
                const receivedHeight = last7DaysData.maxVal > 0 ? (day.received / last7DaysData.maxVal) * 120 : 0;
                const pendingHeight = last7DaysData.maxVal > 0 ? (day.pending / last7DaysData.maxVal) * 120 : 0;

                return (
                  <div
                    key={day.dateStr}
                    style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredBar(day)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip on hover */}
                    {hoveredBar?.dateStr === day.dateStr && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        marginBottom: '8px',
                        background: 'rgba(29, 29, 31, 0.95)',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        whiteSpace: 'nowrap',
                        zIndex: 20,
                        boxShadow: 'var(--shadow-md)',
                        pointerEvents: 'none'
                      }}>
                        <div style={{ fontWeight: 600 }}>{day.dateStr}</div>
                        <div style={{ color: '#34D399' }}>Received: {formatCurrency(day.received)}</div>
                        {day.pending > 0 && <div style={{ color: '#FBBF24' }}>Pending: {formatCurrency(day.pending)}</div>}
                      </div>
                    )}

                    {/* Bars Container */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                      {/* Received Bar */}
                      <div
                        style={{
                          width: '12px',
                          height: `${Math.max(receivedHeight, day.received > 0 ? 6 : 2)}px`,
                          background: day.received > 0 ? 'var(--color-success)' : 'var(--color-border)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                      {/* Pending Bar */}
                      <div
                        style={{
                          width: '12px',
                          height: `${Math.max(pendingHeight, day.pending > 0 ? 6 : 2)}px`,
                          background: day.pending > 0 ? 'var(--color-warning)' : 'var(--color-border-light)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                    </div>

                    {/* Day label */}
                    <span style={{
                      position: 'absolute',
                      bottom: 0,
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      fontWeight: idx === 6 ? 600 : 400
                    }}>
                      {day.dayLabel}
                    </span>
                  </div>
                );
              })}

            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border-light)',
              fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)'
            }}>
              <span>Last 7 Days Revenue: <strong>{formatCurrency(weekReceived)}</strong></span>
              <span style={{ color: 'var(--color-text-tertiary)' }}>Hover on bars to inspect details</span>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================
          3. Tab Switcher & Search Bar
          ========================================================= */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-4)'
      }}>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          background: 'var(--color-surface)',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}>
          <button
            onClick={() => setActiveTab('received')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              background: activeTab === 'received' ? 'var(--color-accent)' : 'transparent',
              color: activeTab === 'received' ? 'white' : 'var(--color-text-secondary)',
              transition: 'all 0.15s'
            }}
            id="tab-received-payments"
          >
            Received Payments ({payments.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              background: activeTab === 'pending' ? 'var(--color-warning)' : 'transparent',
              color: activeTab === 'pending' ? 'white' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
            id="tab-needs-to-get"
          >
            Needs to Get
            {pendingVisits.length > 0 && (
              <span style={{
                background: activeTab === 'pending' ? 'rgba(0,0,0,0.2)' : 'var(--color-warning-light)',
                color: activeTab === 'pending' ? 'white' : 'var(--color-warning-text)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {pendingVisits.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
          <input
            type="text"
            className="form-input"
            placeholder={activeTab === 'received' ? "Search patient or note..." : "Search pending patient..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px' }}
          />
        </div>

      </div>

      {/* Filter Pills for Received Payments */}
      {activeTab === 'received' && (
        <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'upi', label: 'UPI' },
            { key: 'cash', label: 'Cash' },
            { key: 'card', label: 'Card' },
          ].map(v => (
            <button
              key={v.key}
              className={`filter-pill ${receivedFilter === v.key ? 'active' : ''}`}
              onClick={() => setReceivedFilter(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* =========================================================
          4. Tab 1 Content: Received Payments Ledger
          ========================================================= */}
      {activeTab === 'received' && (
        filteredPayments.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CreditCard className="empty-state-icon" />
              <div className="empty-state-title">No received payments found</div>
              <div className="empty-state-text">
                {searchQuery || receivedFilter !== 'all'
                  ? 'Try clearing the search query or changing filters.'
                  : 'Start by recording your first patient payment.'}
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/payments/new')}>
                Record Payment
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Amount Received</th>
                    <th>Payment Method</th>
                    <th>Notes / Procedure</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => {
                    const patient = PatientsService.getById(p.patient_id);
                    return (
                      <tr
                        key={p.payment_id}
                        className="clickable"
                        onClick={() => patient && navigate(`/patients/${patient.patient_id}`)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: 'var(--radius-full)',
                              background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 600, fontSize: 'var(--font-size-xs)', flexShrink: 0
                            }}>
                              {getInitials(patient?.name || '?')}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{patient?.name || 'Unknown Patient'}</div>
                              {patient?.phone && (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                  {patient.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(p.payment_date)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--color-success-text)', fontSize: 'var(--font-size-base)' }}>
                            {formatCurrency(p.amount)}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-confirmed">
                            {p.payment_method || 'Cash'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', maxWidth: '240px' }} className="truncate">
                          {p.notes || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              patient && navigate(`/patients/${patient.patient_id}`);
                            }}
                            title="View patient dossier"
                          >
                            View Patient <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* =========================================================
          5. Tab 2 Content: "Needs to Get" (Pending Receivables)
          ========================================================= */}
      {activeTab === 'pending' && (
        pendingVisits.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CheckCircle2 className="empty-state-icon" style={{ color: 'var(--color-success)' }} />
              <div className="empty-state-title">No Pending Balances!</div>
              <div className="empty-state-text">
                All patient visits are fully paid. There is currently no money left to collect.
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Visit Date</th>
                    <th>Treatment / Complaint</th>
                    <th>Total Cost</th>
                    <th>Already Paid</th>
                    <th>Needs to Get (Balance)</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVisits.map(v => (
                    <tr
                      key={v.visit_id}
                      className="clickable"
                      onClick={() => navigate(`/patients/${v.patient_id}`)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-warning-light)', color: 'var(--color-warning)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: 'var(--font-size-xs)', flexShrink: 0
                          }}>
                            {getInitials(v.patientName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{v.patientName}</div>
                            {v.patientPhone && (
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                {v.patientPhone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(v.visit_date)}</td>
                      <td style={{ maxWidth: '200px' }} className="truncate">
                        <span style={{ fontWeight: 500 }}>{v.treatment || v.complaint || 'Dental Consultation'}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>
                        {formatCurrency(v.total_amount)}
                      </td>
                      <td style={{ color: 'var(--color-success-text)' }}>
                        {formatCurrency(v.amount_paid)}
                      </td>
                      <td>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--color-warning-light)',
                          color: 'var(--color-warning-text)',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid #FDE68A',
                          fontSize: 'var(--font-size-sm)'
                        }}>
                          <Clock size={12} />
                          {formatCurrency(v.balance)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/payments/new?patient=${v.patient_id}`);
                          }}
                          style={{
                            background: 'var(--color-success)',
                            borderColor: 'var(--color-success)'
                          }}
                        >
                          <Plus size={14} /> Collect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

    </div>
  );
}
