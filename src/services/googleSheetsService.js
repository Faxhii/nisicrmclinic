// ============================================================
// Google Sheets Integration Service via Google Apps Script Web App
// ============================================================

const STORAGE_KEYS = {
  URL: 'nisiclinic_sheets_url',
  AUTO_SYNC: 'nisiclinic_auto_sync',
  LAST_SYNCED: 'nisiclinic_last_synced',
  STATUS: 'nisiclinic_sync_status'
};

export const GoogleSheetsService = {
  getUrl() {
    return localStorage.getItem(STORAGE_KEYS.URL) || '';
  },

  setUrl(url) {
    if (url) {
      localStorage.setItem(STORAGE_KEYS.URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.URL);
    }
  },

  isConfigured() {
    const url = this.getUrl();
    return !!url && url.startsWith('https://script.google.com/macros/s/');
  },

  getAutoSync() {
    const val = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
    return val === null ? true : val === 'true';
  },

  setAutoSync(enabled) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, String(enabled));
  },

  getLastSynced() {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNCED) || null;
  },

  setLastSynced(isoString = new Date().toISOString()) {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, isoString);
  },

  // Test connection to Google Apps Script
  async testConnection(targetUrl = null) {
    const url = targetUrl || this.getUrl();
    if (!url) {
      return { success: false, error: 'No Google Apps Script Web App URL provided.' };
    }

    try {
      const pingUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping`;
      const response = await fetch(pingUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'success') {
        return {
          success: true,
          message: data.message || 'Connected successfully!',
          spreadsheetName: data.spreadsheetName
        };
      } else {
        return { success: false, error: data.message || 'Verification failed.' };
      }
    } catch (err) {
      return {
        success: false,
        error: `Could not connect to Google Apps Script: ${err.message}. Please verify the deployment access is set to "Anyone".`
      };
    }
  },

  // Pull all tables from Google Sheet into localStorage
  async pullFromSheet() {
    const url = this.getUrl();
    if (!url) throw new Error('Google Apps Script URL is not configured.');

    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAll`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from sheet: HTTP ${response.status}`);
    }

    const res = await response.json();
    if (res.status !== 'success' || !res.data) {
      throw new Error(res.message || 'Failed to retrieve data from Google Sheet.');
    }

    const { patients, visits, appointments, payments } = res.data;

    if (Array.isArray(patients)) {
      localStorage.setItem('nisiclinic_patients', JSON.stringify(patients));
    }
    if (Array.isArray(visits)) {
      localStorage.setItem('nisiclinic_visits', JSON.stringify(visits));
    }
    if (Array.isArray(appointments)) {
      localStorage.setItem('nisiclinic_appointments', JSON.stringify(appointments));
    }
    if (Array.isArray(payments)) {
      localStorage.setItem('nisiclinic_payments', JSON.stringify(payments));
    }

    this.setLastSynced();
    return {
      patientsCount: patients?.length || 0,
      visitsCount: visits?.length || 0,
      appointmentsCount: appointments?.length || 0,
      paymentsCount: payments?.length || 0
    };
  },

  // Push all local tables to Google Sheet
  async pushToSheet(data) {
    const url = this.getUrl();
    if (!url) throw new Error('Google Apps Script URL is not configured.');

    const payload = {
      action: 'syncAll',
      data: {
        patients: data.patients || [],
        visits: data.visits || [],
        appointments: data.appointments || [],
        payments: data.payments || []
      }
    };

    // Use text/plain to prevent CORS preflight rejection from Google Apps Script
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Push failed: HTTP ${response.status}`);
    }

    const res = await response.json();
    if (res.status === 'success') {
      this.setLastSynced();
      return true;
    } else {
      throw new Error(res.message || 'Failed to update Google Sheet');
    }
  },

  // Background non-blocking sync for single actions
  async syncSingle(action, payload) {
    if (!this.isConfigured() || !this.getAutoSync()) return;

    const url = this.getUrl();
    try {
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        keepalive: true
      }).catch(err => {
        console.warn('Background sync failed:', err);
      });
    } catch (e) {
      console.warn('Background sync error:', e);
    }
  }
};
