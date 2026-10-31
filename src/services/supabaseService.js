// ============================================================
// Supabase Sync Service — Replaces Google Sheets
// Handles bidirectional sync and realtime updates with Supabase
// ============================================================

import { getSupabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_PREFIX = 'nisiclinic_';

function getLocal(collection) {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + collection);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocal(collection, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving ${collection}:`, err);
  }
}

let activeChannel = null;

export const SupabaseService = {
  isConfigured() {
    return isSupabaseConfigured();
  },

  // Pull all tables from Supabase into local cache
  async pullAll() {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const [
        { data: patients, error: pErr },
        { data: visits, error: vErr },
        { data: payments, error: payErr },
        { data: appointments, error: aErr },
        { data: medicines, error: mErr }
      ] = await Promise.all([
        supabase.from('patients').select('*').order('created_at', { ascending: false }),
        supabase.from('visits').select('*').order('visit_date', { ascending: false }),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('appointments').select('*').order('date', { ascending: false }),
        supabase.from('medicines').select('*').order('name', { ascending: true })
      ]);

      if (pErr) console.warn('Supabase fetch patients error:', pErr);
      if (vErr) console.warn('Supabase fetch visits error:', vErr);
      if (payErr) console.warn('Supabase fetch payments error:', payErr);
      if (aErr) console.warn('Supabase fetch appointments error:', aErr);
      if (mErr) console.warn('Supabase fetch medicines error:', mErr);

      if (patients) setLocal('patients', patients);
      if (visits) setLocal('visits', visits);
      if (payments) setLocal('payments', payments);
      if (appointments) setLocal('appointments', appointments);
      if (medicines) setLocal('medicines', medicines);

      try {
        window.dispatchEvent(new Event('nisiclinic_data_synced'));
      } catch {}

      return {
        patientsCount: patients ? patients.length : 0,
        visitsCount: visits ? visits.length : 0,
        paymentsCount: payments ? payments.length : 0,
        appointmentsCount: appointments ? appointments.length : 0,
        medicinesCount: medicines ? medicines.length : 0
      };
    } catch (err) {
      console.error('Failed to pull from Supabase:', err);
      throw err;
    }
  },

  // Push local data into Supabase (upsert)
  async pushAll() {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const patients = getLocal('patients');
    const visits = getLocal('visits');
    const payments = getLocal('payments');
    const appointments = getLocal('appointments');
    const medicines = getLocal('medicines');

    if (patients.length) await supabase.from('patients').upsert(patients);
    if (visits.length) await supabase.from('visits').upsert(visits);
    if (payments.length) await supabase.from('payments').upsert(payments);
    if (appointments.length) await supabase.from('appointments').upsert(appointments);
    if (medicines.length) await supabase.from('medicines').upsert(medicines);

    return true;
  },

  // Sync a single action to Supabase asynchronously
  async sync(entity, action, payload) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      if (entity === 'patient') {
        if (action === 'create' || action === 'update') {
          await supabase.from('patients').upsert(payload);
        } else if (action === 'delete') {
          await supabase.from('patients').delete().eq('patient_id', payload.patient_id);
        }
      } else if (entity === 'visit') {
        if (action === 'create' || action === 'update') {
          await supabase.from('visits').upsert(payload);
        } else if (action === 'delete') {
          await supabase.from('visits').delete().eq('visit_id', payload.visit_id);
        }
      } else if (entity === 'payment') {
        if (action === 'create' || action === 'update') {
          await supabase.from('payments').upsert(payload);
        } else if (action === 'delete') {
          await supabase.from('payments').delete().eq('payment_id', payload.payment_id);
        }
      } else if (entity === 'appointment') {
        if (action === 'create' || action === 'update') {
          await supabase.from('appointments').upsert(payload);
        } else if (action === 'delete') {
          await supabase.from('appointments').delete().eq('appointment_id', payload.appointment_id);
        }
      } else if (entity === 'medicine') {
        if (action === 'create' || action === 'update') {
          await supabase.from('medicines').upsert(payload);
        } else if (action === 'delete') {
          await supabase.from('medicines').delete().eq('medicine_id', payload.medicine_id);
        }
      }
    } catch (err) {
      console.warn(`Supabase sync ${entity}:${action} error:`, err);
    }
  },

  // Enable Realtime Subscription
  subscribeRealtime() {
    const supabase = getSupabase();
    if (!supabase || activeChannel) return;

    try {
      activeChannel = supabase
        .channel('nisiclinic-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          this.pullAll().catch(() => {});
        })
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription not supported or failed:', err);
    }
  },

  unsubscribeRealtime() {
    const supabase = getSupabase();
    if (supabase && activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  }
};
