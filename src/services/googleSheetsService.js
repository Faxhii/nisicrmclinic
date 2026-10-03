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
    const local = localStorage.getItem(STORAGE_KEYS.URL);
    if (local && local.trim()) return local.trim();
    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_SHEETS_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();
    return '';
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

  // Pull all tables from Google Sheet into localStorage with smart merge
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

    const { patients: sheetPatients, visits: sheetVisits, appointments: sheetAppts, payments: sheetPayments } = res.data;

    // Smart merge to preserve any items created locally on this device (e.g. on a new laptop) before connecting
    const mergeData = (storageKey, idField, sheetItems) => {
      let localItems = [];
      try {
        const raw = localStorage.getItem(storageKey);
        localItems = raw ? JSON.parse(raw) : [];
      } catch {
        localItems = [];
      }

      if (!Array.isArray(sheetItems)) sheetItems = [];

      const map = new Map();
      sheetItems.forEach(item => {
        if (item && item[idField]) map.set(String(item[idField]), item);
      });

      const localOnly = [];
      localItems.forEach(item => {
        if (item && item[idField]) {
          const id = String(item[idField]);
          if (!map.has(id)) {
            // Keep local item that isn't on sheet yet
            map.set(id, item);
            localOnly.push(item);
          }
        }
      });

      const merged = Array.from(map.values());
      localStorage.setItem(storageKey, JSON.stringify(merged));
      return { merged, localOnly };
    };

    const pResult = mergeData('nisiclinic_patients', 'patient_id', sheetPatients);
    const vResult = mergeData('nisiclinic_visits', 'visit_id', sheetVisits);
    const aResult = mergeData('nisiclinic_appointments', 'appointment_id', sheetAppts);
    const payResult = mergeData('nisiclinic_payments', 'payment_id', sheetPayments);

    this.setLastSynced();

    // If there were local items not on the sheet, push them to the sheet so all devices receive them
    const hasLocalOnly = pResult.localOnly.length > 0 || vResult.localOnly.length > 0 || 
                         aResult.localOnly.length > 0 || payResult.localOnly.length > 0;
    if (hasLocalOnly && this.getAutoSync()) {
      this.pushToSheet({
        patients: pResult.merged,
        visits: vResult.merged,
        appointments: aResult.merged,
        payments: payResult.merged
      }).catch(err => console.warn('Background sync back to sheet error:', err));
    }

    try {
      window.dispatchEvent(new Event('nisiclinic_data_synced'));
    } catch {}

    return {
      patientsCount: pResult.merged.length,
      visitsCount: vResult.merged.length,
      appointmentsCount: aResult.merged.length,
      paymentsCount: payResult.merged.length
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
