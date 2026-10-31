import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pill, Plus, Search, Package, AlertTriangle, TrendingDown,
  Edit, Trash2, X, Save, ChevronRight, ArrowUpDown,
  Calendar, DollarSign, BarChart3, Clock, Filter, Check,
  AlertCircle, PackagePlus, PackageMinus, History
} from 'lucide-react';
import { MedicinesService } from '../services/dataService';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Gel', 'Paste', 'Cream', 'Drops', 'Spray', 'Powder', 'Inhaler', 'Patch', 'Other'];
const CATEGORIES = ['Analgesic', 'Antibiotic', 'NSAID', 'Antiseptic', 'Local Anesthetic', 'Dental Care', 'Topical NSAID', 'Antifungal', 'Steroid', 'Vitamin', 'General', 'Other'];

export default function MedicinesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_medicines');

  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all | in-stock | low-stock | out-of-stock | expiring
  const [sortBy, setSortBy] = useState('name'); // name | stock | price | expiry
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMed, setStockMed] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState({ qty: '', type: 'add', reason: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(null);

  const [form, setForm] = useState({
    name: '', generic_name: '', category: 'General', dosage_form: 'Tablet',
    strength: '', unit_price: '', stock_qty: '', reorder_level: '10',
    expiry_date: '', manufacturer: '', notes: ''
  });

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('nisiclinic_data_synced', handleSync);
    return () => window.removeEventListener('nisiclinic_data_synced', handleSync);
  }, []);

  function loadData() {
    setMedicines(MedicinesService.getAll());
  }

  // KPI stats
  const stats = useMemo(() => {
    const all = medicines;
    const inStock = all.filter(m => (Number(m.stock_qty) || 0) > 0);
    const lowStock = all.filter(m => {
      const qty = Number(m.stock_qty) || 0;
      const reorder = Number(m.reorder_level) || 10;
      return qty > 0 && qty <= reorder;
    });
    const outOfStock = all.filter(m => (Number(m.stock_qty) || 0) <= 0);
    const totalValue = all.reduce((sum, m) => sum + ((Number(m.unit_price) || 0) * (Number(m.stock_qty) || 0)), 0);

    const today = new Date().toISOString().split('T')[0];
    const cutoff30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const expiringSoon = all.filter(m => m.expiry_date && m.expiry_date >= today && m.expiry_date <= cutoff30);

    return { total: all.length, inStock: inStock.length, lowStock: lowStock.length, outOfStock: outOfStock.length, totalValue, expiringSoon: expiringSoon.length };
  }, [medicines]);

  // Filtered & sorted list
  const filteredMedicines = useMemo(() => {
    let list = [...medicines];

    // Filters
    switch (activeFilter) {
      case 'in-stock':
        list = list.filter(m => (Number(m.stock_qty) || 0) > 0);
        break;
      case 'low-stock':
        list = list.filter(m => {
          const qty = Number(m.stock_qty) || 0;
          const reorder = Number(m.reorder_level) || 10;
          return qty > 0 && qty <= reorder;
        });
        break;
      case 'out-of-stock':
        list = list.filter(m => (Number(m.stock_qty) || 0) <= 0);
        break;
      case 'expiring': {
        const today = new Date().toISOString().split('T')[0];
        const cutoff = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        list = list.filter(m => m.expiry_date && m.expiry_date >= today && m.expiry_date <= cutoff);
        break;
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.generic_name || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        (m.manufacturer || '').toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'stock':
        list.sort((a, b) => (Number(a.stock_qty) || 0) - (Number(b.stock_qty) || 0));
        break;
      case 'price':
        list.sort((a, b) => (Number(b.unit_price) || 0) - (Number(a.unit_price) || 0));
        break;
      case 'expiry':
        list.sort((a, b) => (a.expiry_date || 'z').localeCompare(b.expiry_date || 'z'));
        break;
      default:
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [medicines, activeFilter, searchQuery, sortBy]);

  function resetForm() {
    setForm({
      name: '', generic_name: '', category: 'General', dosage_form: 'Tablet',
      strength: '', unit_price: '', stock_qty: '', reorder_level: '10',
      expiry_date: '', manufacturer: '', notes: ''
    });
  }

  function openAddModal() {
    resetForm();
    setEditingMed(null);
    setShowAddModal(true);
  }

  function openEditModal(med) {
    setEditingMed(med);
    setForm({
      name: med.name || '',
      generic_name: med.generic_name || '',
      category: med.category || 'General',
      dosage_form: med.dosage_form || 'Tablet',
      strength: med.strength || '',
      unit_price: med.unit_price?.toString() || '',
      stock_qty: med.stock_qty?.toString() || '',
      reorder_level: med.reorder_level?.toString() || '10',
      expiry_date: med.expiry_date || '',
      manufacturer: med.manufacturer || '',
      notes: med.notes || ''
    });
    setShowAddModal(true);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Medicine name is required.'); return; }

    if (editingMed) {
      MedicinesService.update(editingMed.medicine_id, {
        name: form.name.trim(),
        generic_name: form.generic_name.trim(),
        category: form.category,
        dosage_form: form.dosage_form,
        strength: form.strength.trim(),
        unit_price: Number(form.unit_price) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 10,
        expiry_date: form.expiry_date,
        manufacturer: form.manufacturer.trim(),
        notes: form.notes.trim()
      });
      toast.success(`${form.name} updated successfully!`);
    } else {
      MedicinesService.create({
        name: form.name.trim(),
        generic_name: form.generic_name.trim(),
        category: form.category,
        dosage_form: form.dosage_form,
        strength: form.strength.trim(),
        unit_price: Number(form.unit_price) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 10,
        expiry_date: form.expiry_date,
        manufacturer: form.manufacturer.trim(),
        notes: form.notes.trim()
      });
      toast.success(`${form.name} added to inventory!`);
    }

    setShowAddModal(false);
    setEditingMed(null);
    loadData();
    try { window.dispatchEvent(new Event('nisiclinic_data_synced')); } catch {}
  }

  function handleDelete(medId) {
    MedicinesService.delete(medId);
    toast.success('Medicine removed from inventory.');
    setShowDeleteConfirm(null);
    loadData();
  }

  function openStockAdjust(med) {
    setStockMed(med);
    setStockAdjustment({ qty: '', type: 'add', reason: '' });
    setShowStockModal(true);
  }

  function handleStockAdjust(e) {
    e.preventDefault();
    if (!stockMed) return;
    const qty = Number(stockAdjustment.qty);
    if (!qty || qty <= 0) { toast.warning('Enter a valid quantity.'); return; }

    const change = stockAdjustment.type === 'add' ? qty : -qty;
    const result = MedicinesService.adjustStock(
      stockMed.medicine_id,
      change,
      stockAdjustment.reason || (stockAdjustment.type === 'add' ? 'Stock replenished' : 'Stock deducted')
    );

    if (result) {
      toast.success(`Stock ${stockAdjustment.type === 'add' ? 'added' : 'deducted'}: ${qty} units of ${stockMed.name}`);
    } else {
      toast.error('Insufficient stock for deduction.');
    }

    setShowStockModal(false);
    loadData();
  }

  function getStockBadge(med) {
    const qty = Number(med.stock_qty) || 0;
    const reorder = Number(med.reorder_level) || 10;
    if (qty <= 0) return { label: 'Out of Stock', className: 'badge-cancelled', color: '#EF4444' };
    if (qty <= reorder) return { label: 'Low Stock', className: 'badge-waiting', color: '#F59E0B' };
    return { label: 'In Stock', className: 'badge-completed', color: '#22C55E' };
  }

  return (
    <div className="app-content animate-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Medicines Inventory</h1>
            <p className="page-subtitle">
              Manage medicine stock, track inventory levels, and monitor expiry dates.
            </p>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={openAddModal} id="add-medicine-btn">
              <Plus size={16} /> Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Total Medicines</div>
            <div className="stat-card-icon" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
              <Pill size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-sub">
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{stats.inStock}</span> currently in stock
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Inventory Value</div>
            <div className="stat-card-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-success-text)' }}>
            {formatCurrency(stats.totalValue)}
          </div>
          <div className="stat-card-sub">Total stock × unit price</div>
        </div>

        <div className="stat-card" style={{ borderLeft: `4px solid ${stats.lowStock > 0 ? '#F59E0B' : 'var(--color-border)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Low Stock Alerts</div>
            <div className="stat-card-icon" style={{
              background: stats.lowStock > 0 ? 'var(--color-warning-light)' : 'var(--color-bg)',
              color: stats.lowStock > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)'
            }}>
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: stats.lowStock > 0 ? 'var(--color-warning-text)' : 'var(--color-text-secondary)' }}>
            {stats.lowStock}
          </div>
          <div className="stat-card-sub">
            {stats.lowStock > 0 ? 'Need reordering soon' : 'All stocks healthy'}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: `4px solid ${stats.outOfStock > 0 ? '#EF4444' : 'var(--color-border)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label">Out of Stock</div>
            <div className="stat-card-icon" style={{
              background: stats.outOfStock > 0 ? '#FEE2E2' : 'var(--color-bg)',
              color: stats.outOfStock > 0 ? '#EF4444' : 'var(--color-text-tertiary)'
            }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: stats.outOfStock > 0 ? '#EF4444' : 'var(--color-text-secondary)' }}>
            {stats.outOfStock}
          </div>
          <div className="stat-card-sub">
            {stats.outOfStock > 0 ? 'Require immediate restocking' : 'No stockouts ✓'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: 'var(--space-4)',
        marginBottom: 'var(--space-4)'
      }}>
        <div className="filter-pills">
          {[
            { key: 'all', label: `All (${stats.total})` },
            { key: 'in-stock', label: `In Stock (${stats.inStock})` },
            { key: 'low-stock', label: `Low Stock (${stats.lowStock})` },
            { key: 'out-of-stock', label: `Out (${stats.outOfStock})` },
            { key: 'expiring', label: `Expiring (${stats.expiringSoon})` },
          ].map(f => (
            <button
              key={f.key}
              className={`filter-pill ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px' }}
            />
          </div>
          <select
            className="form-input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ height: '38px', width: '140px', fontSize: 'var(--font-size-sm)' }}
          >
            <option value="name">Sort: Name</option>
            <option value="stock">Sort: Stock ↑</option>
            <option value="price">Sort: Price ↓</option>
            <option value="expiry">Sort: Expiry</option>
          </select>
        </div>
      </div>

      {/* Medicines Table */}
      {filteredMedicines.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Pill className="empty-state-icon" />
            <div className="empty-state-title">No medicines found</div>
            <div className="empty-state-text">
              {searchQuery || activeFilter !== 'all'
                ? 'Try clearing the search or changing filters.'
                : 'Start by adding your first medicine to the inventory.'}
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={16} /> Add Medicine
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Category</th>
                  <th>Form</th>
                  <th>Unit Price</th>
                  <th>Stock Qty</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map(med => {
                  const badge = getStockBadge(med);
                  const isExpired = med.expiry_date && med.expiry_date < new Date().toISOString().split('T')[0];

                  return (
                    <tr key={med.medicine_id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{med.name}</div>
                          {med.generic_name && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              {med.generic_name}
                            </div>
                          )}
                          {med.manufacturer && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                              {med.manufacturer}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-confirmed" style={{ fontSize: '11px' }}>
                          {med.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>
                        {med.dosage_form}{med.strength ? ` · ${med.strength}` : ''}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatCurrency(med.unit_price)}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 'var(--font-size-base)',
                          color: badge.color
                        }}>
                          {Number(med.stock_qty) || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{
                        color: isExpired ? '#EF4444' : 'var(--color-text-secondary)',
                        fontWeight: isExpired ? 600 : 400
                      }}>
                        {isExpired && '⚠ '}
                        {med.expiry_date ? formatDate(med.expiry_date) : '—'}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openStockAdjust(med)}
                              title="Adjust stock"
                              style={{ color: 'var(--color-accent)' }}
                            >
                              <Package size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setShowLogsModal(med)}
                              title="Stock history"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              <History size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditModal(med)}
                              title="Edit medicine"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setShowDeleteConfirm(med)}
                              title="Delete medicine"
                              style={{ color: '#EF4444' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingMed(null); }}>
        <div style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
              {editingMed ? 'Edit Medicine' : 'Add New Medicine'}
            </h2>
            <button className="btn btn-icon btn-ghost" onClick={() => { setShowAddModal(false); setEditingMed(null); }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label required">Medicine Name</label>
              <input type="text" className="form-input" placeholder="e.g. Paracetamol 500mg"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Name</label>
              <input type="text" className="form-input" placeholder="e.g. Acetaminophen"
                value={form.generic_name} onChange={e => setForm(p => ({ ...p, generic_name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dosage Form</label>
                <select className="form-input" value={form.dosage_form} onChange={e => setForm(p => ({ ...p, dosage_form: e.target.value }))}>
                  {DOSAGE_FORMS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Strength</label>
                <input type="text" className="form-input" placeholder="e.g. 500mg"
                  value={form.strength} onChange={e => setForm(p => ({ ...p, strength: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (₹)</label>
                <input type="number" className="form-input" placeholder="0" min="0"
                  value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Stock Quantity</label>
                <input type="number" className="form-input" placeholder="0" min="0"
                  value={form.stock_qty} onChange={e => setForm(p => ({ ...p, stock_qty: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reorder Level</label>
                <input type="number" className="form-input" placeholder="10" min="0"
                  value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input type="date" className="form-input"
                  value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Manufacturer</label>
                <input type="text" className="form-input" placeholder="e.g. Cipla"
                  value={form.manufacturer} onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input type="text" className="form-input" placeholder="Any additional notes..."
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditingMed(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> {editingMed ? 'Update Medicine' : 'Add to Inventory'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal isOpen={showStockModal} onClose={() => setShowStockModal(false)}>
        <div style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Adjust Stock</h2>
            <button className="btn btn-icon btn-ghost" onClick={() => setShowStockModal(false)}>
              <X size={18} />
            </button>
          </div>
          {stockMed && (
            <form onSubmit={handleStockAdjust}>
              <div style={{
                padding: 'var(--space-3)', background: 'var(--color-accent-light)',
                borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)'
              }}>
                <div style={{ fontWeight: 600 }}>{stockMed.name}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Current Stock: <strong style={{ color: getStockBadge(stockMed).color }}>{Number(stockMed.stock_qty) || 0}</strong> units
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Action</label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button"
                      className={`btn ${stockAdjustment.type === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setStockAdjustment(p => ({ ...p, type: 'add' }))}
                      style={{ flex: 1, gap: '6px' }}
                    >
                      <PackagePlus size={16} /> Add Stock
                    </button>
                    <button type="button"
                      className={`btn ${stockAdjustment.type === 'deduct' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setStockAdjustment(p => ({ ...p, type: 'deduct' }))}
                      style={{
                        flex: 1, gap: '6px',
                        ...(stockAdjustment.type === 'deduct' ? { background: '#EF4444', borderColor: '#EF4444' } : {})
                      }}
                    >
                      <PackageMinus size={16} /> Deduct
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label required">Quantity</label>
                <input type="number" className="form-input" placeholder="0" min="1"
                  value={stockAdjustment.qty} onChange={e => setStockAdjustment(p => ({ ...p, qty: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input type="text" className="form-input" placeholder="e.g. New shipment received"
                  value={stockAdjustment.reason} onChange={e => setStockAdjustment(p => ({ ...p, reason: e.target.value }))} />
              </div>

              {stockAdjustment.qty && (
                <div style={{
                  padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
                  background: stockAdjustment.type === 'add' ? 'var(--color-success-light)' : '#FEE2E2',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                  color: stockAdjustment.type === 'add' ? 'var(--color-success-text)' : '#EF4444'
                }}>
                  New stock will be: {Math.max(0, (Number(stockMed.stock_qty) || 0) + (stockAdjustment.type === 'add' ? Number(stockAdjustment.qty) : -Number(stockAdjustment.qty)))} units
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Confirm Adjustment
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)}>
        <div style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius-full)',
            background: '#FEE2E2', color: '#EF4444', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)'
          }}>
            <Trash2 size={24} />
          </div>
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>Delete Medicine?</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
            Remove <strong>{showDeleteConfirm?.name}</strong> from inventory? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => handleDelete(showDeleteConfirm.medicine_id)}
              style={{ background: '#EF4444', borderColor: '#EF4444' }}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Stock Logs Modal */}
      <Modal isOpen={!!showLogsModal} onClose={() => setShowLogsModal(null)}>
        <div style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
              Stock History — {showLogsModal?.name}
            </h2>
            <button className="btn btn-icon btn-ghost" onClick={() => setShowLogsModal(null)}>
              <X size={18} />
            </button>
          </div>
          {showLogsModal && (() => {
            const logs = MedicinesService.getStockLogs(showLogsModal.medicine_id);
            if (logs.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-tertiary)' }}>
                  <History size={32} style={{ opacity: 0.3, marginBottom: 'var(--space-2)' }} />
                  <div>No stock adjustments recorded yet.</div>
                </div>
              );
            }
            return (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {logs.map((log, i) => (
                  <div key={log.log_id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius-full)',
                      background: log.change > 0 ? 'var(--color-success-light)' : '#FEE2E2',
                      color: log.change > 0 ? 'var(--color-success)' : '#EF4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {log.change > 0 ? <PackagePlus size={16} /> : <PackageMinus size={16} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                        {log.change > 0 ? '+' : ''}{log.change} units
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {log.reason || 'No reason specified'} · {log.previous_qty} → {log.new_qty}
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {formatDate(log.timestamp?.split('T')[0])}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}
