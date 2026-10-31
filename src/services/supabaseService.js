// ============================================================
// Supabase Sync Service — Cloud PostgreSQL Backend
// Handles bidirectional sync, payload sanitization, and realtime updates
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

// -------------------------------------------------------------
// Payload Sanitizers (PostgreSQL compatibility)
// -------------------------------------------------------------
export function sanitizePatient(patient) {
  if (!patient || !patient.patient_id) return null;
  return {
    patient_id: String(patient.patient_id),
    name: patient.name || 'Unnamed Patient',
    phone: patient.phone || '',
    age: patient.age ? String(patient.age) : null,
    gender: patient.gender || null,
    date_of_birth: patient.date_of_birth && patient.date_of_birth.trim() ? patient.date_of_birth.trim() : null,
    address: patient.address || null,
    medical_notes: patient.medical_notes || null,
    allergies: patient.allergies || null,
    emergency_contact: patient.emergency_contact || null,
    is_archived: Boolean(patient.is_archived),
    created_at: patient.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function sanitizeVisit(visit) {
  if (!visit || !visit.visit_id) return null;
  return {
    visit_id: String(visit.visit_id),
    patient_id: String(visit.patient_id),
    visit_date: visit.visit_date || new Date().toISOString().split('T')[0],
    complaint: visit.complaint || null,
    diagnosis: visit.diagnosis || null,
    clinical_notes: visit.clinical_notes || null,
    treatment: visit.treatment || null,
    medicines: Array.isArray(visit.medicines) ? visit.medicines : [],
    total_amount: Number(visit.total_amount) || 0,
    amount_paid: Number(visit.amount_paid) || 0,
    balance: Number(visit.balance) || 0,
    payment_method: visit.payment_method || 'Cash',
    // In PostgreSQL, DATE columns throw on empty strings: must be null if empty!
    follow_up_date: visit.follow_up_date && visit.follow_up_date.trim() ? visit.follow_up_date.trim() : null,
    created_by: visit.created_by || 'doctor',
    created_at: visit.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function sanitizePayment(payment) {
  if (!payment || !payment.payment_id) return null;
  // If visit_id is empty string or whitespace, Postgres foreign key will fail. Must be null!
  const cleanVisitId = payment.visit_id && payment.visit_id.trim() !== '' ? payment.visit_id.trim() : null;

  return {
    payment_id: String(payment.payment_id),
    patient_id: String(payment.patient_id),
    visit_id: cleanVisitId,
    amount: Number(payment.amount) || 0,
    payment_method: payment.payment_method || 'Cash',
    payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
    notes: payment.notes || null,
    created_at: payment.created_at || new Date().toISOString()
  };
}

export function sanitizeAppointment(appointment) {
  if (!appointment || !appointment.appointment_id) return null;
  return {
    appointment_id: String(appointment.appointment_id),
    patient_id: String(appointment.patient_id),
    date: appointment.date || new Date().toISOString().split('T')[0],
    time: appointment.time || null,
    reason: appointment.reason || null,
    dentist: appointment.dentist || 'Dr. Nisi',
    status: appointment.status || 'Confirmed',
    notes: appointment.notes || null,
    created_at: appointment.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function sanitizeMedicine(medicine) {
  if (!medicine || !medicine.medicine_id) return null;
  return {
    medicine_id: String(medicine.medicine_id),
    name: medicine.name || '',
    category: medicine.category || 'Tablet',
    dosage: medicine.dosage || null,
    frequency: medicine.frequency || null,
    duration: medicine.duration || null,
    instructions: medicine.instructions || null,
    stock_qty: Number(medicine.stock_qty) || 0,
    unit_price: Number(medicine.unit_price) || 0,
    created_at: medicine.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function mergeById(localList, cloudList, idKey) {
  if (!cloudList || cloudList.length === 0) return localList;
  const map = new Map();
  // Put cloud items in map
  cloudList.forEach(item => {
    if (item && item[idKey]) map.set(item[idKey], item);
  });
  // Preserve any local item not yet in cloud
  localList.forEach(item => {
    if (item && item[idKey] && !map.has(item[idKey])) {
      map.set(item[idKey], item);
    }
  });
  return Array.from(map.values());
}

let activeChannel = null;

export const SupabaseService = {
  isConfigured() {
    return isSupabaseConfigured();
  },

  // Pull all tables from Supabase into local cache safely
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

      const localPatients = getLocal('patients');
      const localVisits = getLocal('visits');
      const localPayments = getLocal('payments');

      // SAFETY: If Supabase is totally empty, but local storage has records,
      // DO NOT wipe local storage! Instead auto-upload local data to Supabase!
      const cloudEmpty = (!patients || patients.length === 0) &&
                         (!visits || visits.length === 0) &&
                         (!payments || payments.length === 0);

      const localHasData = localPatients.length > 0 || localVisits.length > 0 || localPayments.length > 0;

      if (cloudEmpty && localHasData) {
        console.log('Supabase tables are currently empty. Auto-pushing local CRM data to Supabase...');
        await this.pushAll();
        return {
          patientsCount: localPatients.length,
          visitsCount: localVisits.length,
          paymentsCount: localPayments.length,
          appointmentsCount: getLocal('appointments').length,
          medicinesCount: getLocal('medicines').length
        };
      }

      // Merge cloud records with local records so unsynced data is never lost
      if (patients) setLocal('patients', mergeById(localPatients, patients, 'patient_id'));
      if (visits) setLocal('visits', mergeById(localVisits, visits, 'visit_id'));
      if (payments) setLocal('payments', mergeById(localPayments, payments, 'payment_id'));
      if (appointments) setLocal('appointments', mergeById(getLocal('appointments'), appointments, 'appointment_id'));
      if (medicines) setLocal('medicines', mergeById(getLocal('medicines'), medicines, 'medicine_id'));

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

    const rawPatients = getLocal('patients');
    const rawVisits = getLocal('visits');
    const rawPayments = getLocal('payments');
    const rawAppointments = getLocal('appointments');
    const rawMedicines = getLocal('medicines');

    const patients = rawPatients.map(sanitizePatient).filter(Boolean);
    const visits = rawVisits.map(sanitizeVisit).filter(Boolean);
    const payments = rawPayments.map(sanitizePayment).filter(Boolean);
    const appointments = rawAppointments.map(sanitizeAppointment).filter(Boolean);
    const medicines = rawMedicines.map(sanitizeMedicine).filter(Boolean);

    // 1. Upload patients first
    if (patients.length) {
      const { error } = await supabase.from('patients').upsert(patients);
      if (error) {
        console.error('Failed to push patients to Supabase:', error);
        throw new Error(`Patients upload error: ${error.message}`);
      }
    }

    // 2. Upload visits second
    if (visits.length) {
      const { error } = await supabase.from('visits').upsert(visits);
      if (error) {
        console.error('Failed to push visits to Supabase:', error);
        throw new Error(`Visits upload error: ${error.message}`);
      }
    }

    // 3. Upload payments third
    if (payments.length) {
      const { error } = await supabase.from('payments').upsert(payments);
      if (error) {
        console.warn('Initial payments upsert failed:', error.message);
        // Fallback: If foreign key on visit_id failed, set visit_id to null and retry
        const fallback = payments.map(p => ({ ...p, visit_id: null }));
        const { error: retryErr } = await supabase.from('payments').upsert(fallback);
        if (retryErr) {
          console.error('Failed to push payments to Supabase:', retryErr);
          throw new Error(`Payments upload error: ${retryErr.message}`);
        }
      }
    }

    // 4. Upload appointments
    if (appointments.length) {
      const { error } = await supabase.from('appointments').upsert(appointments);
      if (error) {
        console.error('Failed to push appointments to Supabase:', error);
        throw new Error(`Appointments upload error: ${error.message}`);
      }
    }

    // 5. Upload medicines
    if (medicines.length) {
      const { error } = await supabase.from('medicines').upsert(medicines);
      if (error) {
        console.error('Failed to push medicines to Supabase:', error);
        throw new Error(`Medicines upload error: ${error.message}`);
      }
    }

    return true;
  },

  // Sync a single action to Supabase asynchronously
  async sync(entity, action, payload) {
    const supabase = getSupabase();
    if (!supabase || !payload) return;

    try {
      if (entity === 'patient') {
        if (action === 'create' || action === 'update') {
          const local = getLocal('patients').find(p => p.patient_id === payload.patient_id);
          const full = local ? { ...local, ...payload } : payload;
          const clean = sanitizePatient(full);
          if (clean) {
            const { error } = await supabase.from('patients').upsert(clean);
            if (error) console.error('Supabase sync patient error:', error);
          }
        } else if (action === 'delete') {
          const { error } = await supabase.from('patients').delete().eq('patient_id', payload.patient_id);
          if (error) console.error('Supabase delete patient error:', error);
        }
      } else if (entity === 'visit') {
        if (action === 'create' || action === 'update') {
          // Ensure patient exists in Supabase first
          if (payload.patient_id) {
            const localPatient = getLocal('patients').find(p => p.patient_id === payload.patient_id);
            if (localPatient) {
              await supabase.from('patients').upsert(sanitizePatient(localPatient));
            }
          }

          const local = getLocal('visits').find(v => v.visit_id === payload.visit_id);
          const full = local ? { ...local, ...payload } : payload;
          const clean = sanitizeVisit(full);
          if (clean) {
            const { error } = await supabase.from('visits').upsert(clean);
            if (error) console.error('Supabase sync visit error:', error);
          }
        } else if (action === 'delete') {
          const { error } = await supabase.from('visits').delete().eq('visit_id', payload.visit_id);
          if (error) console.error('Supabase delete visit error:', error);
        }
      } else if (entity === 'payment') {
        if (action === 'create' || action === 'update') {
          const local = getLocal('payments').find(p => p.payment_id === payload.payment_id);
          const full = local ? { ...local, ...payload } : payload;

          // 1. Ensure parent patient exists in Supabase first!
          if (full.patient_id) {
            const localPatient = getLocal('patients').find(p => p.patient_id === full.patient_id);
            if (localPatient) {
              await supabase.from('patients').upsert(sanitizePatient(localPatient));
            }
          }

          // 2. If payment is linked to a visit, ensure visit exists in Supabase
          if (full.visit_id) {
            const localVisit = getLocal('visits').find(v => v.visit_id === full.visit_id);
            if (localVisit) {
              await supabase.from('visits').upsert(sanitizeVisit(localVisit));
            }
          }

          const clean = sanitizePayment(full);
          if (clean) {
            const { error } = await supabase.from('payments').upsert(clean);
            if (error) {
              console.warn('Supabase sync payment error:', error);
              // Fallback: If foreign key check failed on visit_id, retry with visit_id = null
              if (clean.visit_id) {
                console.log('Retrying payment sync with visit_id = null...');
                clean.visit_id = null;
                const { error: retryErr } = await supabase.from('payments').upsert(clean);
                if (retryErr) console.error('Supabase payment retry failed:', retryErr);
              }
            } else {
              console.log(`Payment ${clean.payment_id} (₹${clean.amount}) successfully synced to Supabase!`);
            }
          }
        } else if (action === 'delete') {
          const { error } = await supabase.from('payments').delete().eq('payment_id', payload.payment_id);
          if (error) console.error('Supabase delete payment error:', error);
        }
      } else if (entity === 'appointment') {
        if (action === 'create' || action === 'update') {
          const local = getLocal('appointments').find(a => a.appointment_id === payload.appointment_id);
          const full = local ? { ...local, ...payload } : payload;

          if (full.patient_id) {
            const localPatient = getLocal('patients').find(p => p.patient_id === full.patient_id);
            if (localPatient) {
              await supabase.from('patients').upsert(sanitizePatient(localPatient));
            }
          }

          const clean = sanitizeAppointment(full);
          if (clean) {
            const { error } = await supabase.from('appointments').upsert(clean);
            if (error) console.error('Supabase sync appointment error:', error);
          }
        } else if (action === 'delete') {
          const { error } = await supabase.from('appointments').delete().eq('appointment_id', payload.appointment_id);
          if (error) console.error('Supabase delete appointment error:', error);
        }
      } else if (entity === 'medicine') {
        if (action === 'create' || action === 'update') {
          const clean = sanitizeMedicine(payload);
          if (clean) {
            const { error } = await supabase.from('medicines').upsert(clean);
            if (error) console.error('Supabase sync medicine error:', error);
          }
        } else if (action === 'delete') {
          const { error } = await supabase.from('medicines').delete().eq('medicine_id', payload.medicine_id);
          if (error) console.error('Supabase delete medicine error:', error);
        }
      }
    } catch (err) {
      console.warn(`Supabase sync ${entity}:${action} unexpected error:`, err);
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
