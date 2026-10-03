import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, X, Cloud } from 'lucide-react';
import { PatientsService } from '../services/dataService';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { debounce } from '../utils/helpers';

export default function Header({ onMenuToggle }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(
    debounce((q) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      const found = PatientsService.search(q).slice(0, 6);
      setResults(found);
    }, 200),
    []
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowResults(true);
    doSearch(val);
  };

  const handleSelect = (patient) => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    navigate(`/patients/${patient.patient_id}`);
  };

  return (
    <header className="app-header">
      <button
        className="btn btn-icon btn-ghost mobile-menu-btn"
        onClick={onMenuToggle}
        id="mobile-menu-btn"
        style={{ display: 'none' }}
      >
        <Menu size={20} />
      </button>

      <div className="header-search" style={{ position: 'relative' }}>
        <Search className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search patients..."
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          id="global-search"
        />
        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 200,
            overflow: 'hidden'
          }}>
            {results.map(p => (
              <button
                key={p.patient_id}
                onClick={() => handleSelect(p)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--color-border-light)',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                  fontSize: 'var(--font-size-base)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {p.phone}
                  </div>
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {p.patient_id}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: 'var(--font-size-xs)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: GoogleSheetsService.isConfigured() ? 'var(--color-success-light)' : 'var(--color-surface-hover)',
            color: GoogleSheetsService.isConfigured() ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
            border: `1px solid ${GoogleSheetsService.isConfigured() ? 'var(--color-success)' : 'var(--color-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          title={GoogleSheetsService.isConfigured() ? 'Google Sheets Live Database Connected' : 'Local Storage Mode — Click to connect Google Sheets'}
          id="header-cloud-status-btn"
        >
          <Cloud size={13} color={GoogleSheetsService.isConfigured() ? 'var(--color-success)' : 'var(--color-text-tertiary)'} />
          <span style={{ fontWeight: 500 }}>
            {GoogleSheetsService.isConfigured() ? 'Google Sheets Live' : 'Local Storage'}
          </span>
        </button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
