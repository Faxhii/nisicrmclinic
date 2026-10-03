// ============================================================
// Data Service Layer — Clean abstraction over storage backend
// Currently uses localStorage; designed for easy swap to
// Google Sheets API or Django REST backend
// ============================================================

import { GoogleSheetsService } from './googleSheetsService';

const STORAGE_PREFIX = 'nisiclinic_';

// Generate unique IDs
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

// Generic CRUD operations
function getAll(collection) {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + collection);
    return data ? JSON.parse(data) : [];
  } catch {
    console.error(`Error reading ${collection}`);
    return [];
  }
}

function saveAll(collection, items) {
  try {
    localStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(items));
    return true;
  } catch {
    console.error(`Error saving ${collection}`);
    return false;
  }
}

function getById(collection, id, idField = 'id') {
  const items = getAll(collection);
  return items.find(item => item[idField] === id) || null;
}

function create(collection, item) {
  const items = getAll(collection);
  items.push(item);
  saveAll(collection, items);
  return item;
}

function update(collection, id, updates, idField = 'id') {
  const items = getAll(collection);
  const index = items.findIndex(item => item[idField] === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates };
  saveAll(collection, items);
  return items[index];
}

function remove(collection, id, idField = 'id') {
  const items = getAll(collection);
  const filtered = items.filter(item => item[idField] !== id);
  saveAll(collection, filtered);
  return filtered.length < items.length;
}

// ============================================================
// Patients Service
// ============================================================

export const PatientsService = {
  getAll() {
    return getAll('patients').sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  },

  getById(patientId) {
    return getById('patients', patientId, 'patient_id');
  },

  create(patientData) {
    const patient = {
      patient_id: generateId('PAT'),
      name: patientData.name,
      phone: patientData.phone,
      age: patientData.age || '',
      gender: patientData.gender || '',
      date_of_birth: patientData.date_of_birth || '',
      address: patientData.address || '',
      medical_notes: patientData.medical_notes || '',
      allergies: patientData.allergies || '',
      emergency_contact: patientData.emergency_contact || '',
      created_at: new Date().toISOString(),
      is_archived: false
    };
    const created = create('patients', patient);
    GoogleSheetsService.syncSingle('createPatient', { patient: created });
    return created;
  },

  update(patientId, updates) {
    const result = update('patients', patientId, updates, 'patient_id');
    GoogleSheetsService.syncSingle('updatePatient', { patient_id: patientId, updates });
    return result;
  },

  archive(patientId) {
    return update('patients', patientId, { is_archived: true }, 'patient_id');
  },

  search(query) {
    const patients = this.getAll();
    const q = query.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.patient_id.toLowerCase().includes(q)
    );
  },

  getOutstandingBalance(patientId) {
    const visits = VisitsService.getByPatient(patientId);
    return visits.reduce((total, v) => total + (Number(v.balance) || 0), 0);
  },

  getLastVisitDate(patientId) {
    const visits = VisitsService.getByPatient(patientId);
    if (!visits.length) return null;
    visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    return visits[0].visit_date;
  }
};

// ============================================================
// Visits Service
// ============================================================

export const VisitsService = {
  getAll() {
    return getAll('visits').sort((a, b) => 
      new Date(b.visit_date) - new Date(a.visit_date)
    );
  },

  getById(visitId) {
    return getById('visits', visitId, 'visit_id');
  },

  getByPatient(patientId) {
    return getAll('visits')
      .filter(v => v.patient_id === patientId)
      .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  },

  create(visitData) {
    const totalAmount = Number(visitData.total_amount) || 0;
    const amountPaid = Number(visitData.amount_paid) || 0;
    const visit = {
      visit_id: generateId('VIS'),
      patient_id: visitData.patient_id,
      visit_date: visitData.visit_date || new Date().toISOString().split('T')[0],
      complaint: visitData.complaint || '',
      diagnosis: visitData.diagnosis || '',
      clinical_notes: visitData.clinical_notes || '',
      treatment: visitData.treatment || '',
      medicines: visitData.medicines || [],
      follow_up_date: visitData.follow_up_date || '',
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance: totalAmount - amountPaid,
      created_by: visitData.created_by || 'doctor',
      created_at: new Date().toISOString()
    };

    const result = create('visits', visit);
    GoogleSheetsService.syncSingle('createVisit', { visit: result });

    // Create payment record if amount paid
    if (amountPaid > 0) {
      PaymentsService.create({
        patient_id: visit.patient_id,
        visit_id: visit.visit_id,
        amount: amountPaid,
        payment_method: visitData.payment_method || 'Cash',
        payment_date: visit.visit_date || new Date().toISOString().split('T')[0],
        notes: `Payment for visit - ${visit.treatment || 'Consultation'}`
      });
    }

    // Create follow-up appointment if date set
    if (visit.follow_up_date) {
      AppointmentsService.create({
        patient_id: visit.patient_id,
        date: visit.follow_up_date,
        time: '10:00',
        reason: `Follow-up: ${visit.treatment || visit.complaint || 'Check-up'}`,
        status: 'Confirmed',
        notes: 'Auto-created from visit follow-up'
      });
    }

    return result;
  },

  update(visitId, updates) {
    const visit = this.getById(visitId);
    if (!visit) return null;

    if (updates.total_amount !== undefined || updates.amount_paid !== undefined) {
      const total = Number(updates.total_amount ?? visit?.total_amount) || 0;
      const paid = Number(updates.amount_paid ?? visit?.amount_paid) || 0;
      updates.balance = Math.max(0, total - paid);
      updates.total_amount = total;
      updates.amount_paid = paid;

      // Keep Payments ledger synchronized with the visit amount_paid
      const allPayments = getAll('payments');
      const visitPayments = allPayments.filter(p => p.visit_id === visitId);
      const currentRecordedPaid = visitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      if (paid > currentRecordedPaid) {
        // Payment amount increased or was added during edit
        const delta = paid - currentRecordedPaid;
        PaymentsService.create({
          patient_id: visit.patient_id,
          visit_id: visitId,
          amount: delta,
          payment_method: updates.payment_method || visit.payment_method || 'Cash',
          payment_date: updates.visit_date || visit.visit_date || new Date().toISOString().split('T')[0],
          notes: `Payment for visit - ${updates.treatment || visit.treatment || 'Consultation'}`
        });
      } else if (paid < currentRecordedPaid && visitPayments.length > 0) {
        // Payment amount was decreased (e.g. correcting a mistake)
        const delta = currentRecordedPaid - paid;
        if (visitPayments.length === 1) {
          const pay = visitPayments[0];
          const newAmt = Math.max(0, (Number(pay.amount) || 0) - delta);
          if (newAmt === 0) {
            remove('payments', pay.payment_id, 'payment_id');
            GoogleSheetsService.syncSingle('deletePayment', { payment_id: pay.payment_id });
          } else {
            update('payments', pay.payment_id, { amount: newAmt }, 'payment_id');
            GoogleSheetsService.syncSingle('updatePayment', { payment_id: pay.payment_id, updates: { amount: newAmt } });
          }
        }
      }
    }

    const result = update('visits', visitId, updates, 'visit_id');
    GoogleSheetsService.syncSingle('updateVisit', { visit_id: visitId, updates });
    return result;
  },

  delete(visitId) {
    const result = remove('visits', visitId, 'visit_id');
    GoogleSheetsService.syncSingle('deleteVisit', { visit_id: visitId });
    return result;
  },

  getTodaysVisits() {
    const today = new Date().toISOString().split('T')[0];
    return getAll('visits').filter(v => v.visit_date === today);
  },

  getTodaysRevenue() {
    return this.getTodaysVisits().reduce((sum, v) => sum + (Number(v.amount_paid) || 0), 0);
  }
};

// ============================================================
// Appointments Service
// ============================================================

export const AppointmentsService = {
  getAll() {
    return getAll('appointments').sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
  },

  getById(appointmentId) {
    return getById('appointments', appointmentId, 'appointment_id');
  },

  getByPatient(patientId) {
    return getAll('appointments')
      .filter(a => a.patient_id === patientId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  create(appointmentData) {
    const appointment = {
      appointment_id: generateId('APT'),
      patient_id: appointmentData.patient_id,
      date: appointmentData.date,
      time: appointmentData.time || '',
      reason: appointmentData.reason || '',
      dentist: appointmentData.dentist || 'Dr. Nisi',
      status: appointmentData.status || 'Confirmed',
      notes: appointmentData.notes || '',
      created_at: new Date().toISOString()
    };
    const result = create('appointments', appointment);
    GoogleSheetsService.syncSingle('createAppointment', { appointment: result });
    return result;
  },

  update(appointmentId, updates) {
    const result = update('appointments', appointmentId, updates, 'appointment_id');
    GoogleSheetsService.syncSingle('updateAppointment', { appointment_id: appointmentId, updates });
    return result;
  },

  cancel(appointmentId) {
    return this.update(appointmentId, { status: 'Cancelled' });
  },

  complete(appointmentId) {
    return this.update(appointmentId, { status: 'Completed' });
  },

  getTodaysAppointments() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(a => a.date === today && a.status !== 'Cancelled');
  },

  getUpcoming() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(a => a.date >= today && a.status !== 'Cancelled');
  },

  getThisWeek() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const start = startOfWeek.toISOString().split('T')[0];
    const end = endOfWeek.toISOString().split('T')[0];
    
    return this.getAll().filter(a => a.date >= start && a.date <= end && a.status !== 'Cancelled');
  }
};

// ============================================================
// Payments Service
// ============================================================

export const PaymentsService = {
  getAll() {
    reconcilePayments();
    return getAll('payments').sort((a, b) => 
      new Date(b.payment_date) - new Date(a.payment_date)
    );
  },

  getById(paymentId) {
    return getById('payments', paymentId, 'payment_id');
  },

  getByPatient(patientId) {
    return getAll('payments')
      .filter(p => p.patient_id === patientId)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  },

  create(paymentData) {
    const payment = {
      payment_id: generateId('PAY'),
      patient_id: paymentData.patient_id,
      visit_id: paymentData.visit_id || '',
      amount: Number(paymentData.amount) || 0,
      payment_method: paymentData.payment_method || 'Cash',
      payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
      notes: paymentData.notes || '',
      created_at: new Date().toISOString()
    };
    const result = create('payments', payment);
    GoogleSheetsService.syncSingle('createPayment', { payment: result });
    return result;
  },

  getTodaysPayments() {
    const today = new Date().toISOString().split('T')[0];
    return getAll('payments').filter(p => p.payment_date === today);
  },

  getTodaysRevenue() {
    return this.getTodaysPayments().reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  },

  getTotalPaidByPatient(patientId) {
    return this.getByPatient(patientId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }
};

// ============================================================
// Follow-ups Service
// ============================================================

export const FollowUpsService = {
  getTodaysFollowUps() {
    const today = new Date().toISOString().split('T')[0];
    const visits = getAll('visits').filter(v => v.follow_up_date === today);
    return visits.map(v => {
      const patient = PatientsService.getById(v.patient_id);
      return {
        ...v,
        patient_name: patient?.name || 'Unknown',
        patient_phone: patient?.phone || ''
      };
    });
  },

  getUpcomingFollowUps() {
    const today = new Date().toISOString().split('T')[0];
    const visits = getAll('visits').filter(v => v.follow_up_date && v.follow_up_date >= today);
    return visits.map(v => {
      const patient = PatientsService.getById(v.patient_id);
      return {
        ...v,
        patient_name: patient?.name || 'Unknown',
        patient_phone: patient?.phone || ''
      };
    }).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  },

  getOverdueFollowUps() {
    const today = new Date().toISOString().split('T')[0];
    const visits = getAll('visits').filter(v => v.follow_up_date && v.follow_up_date < today);
    return visits.map(v => {
      const patient = PatientsService.getById(v.patient_id);
      return {
        ...v,
        patient_name: patient?.name || 'Unknown',
        patient_phone: patient?.phone || ''
      };
    }).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  }
};

// ============================================================
// Dashboard Stats Service
// ============================================================

export const DashboardService = {
  getStats() {
    const todaysAppointments = AppointmentsService.getTodaysAppointments();
    const todaysVisits = VisitsService.getTodaysVisits();
    const allPatients = PatientsService.getAll();

    // Calculate pending payments across all patients
    const pendingPayments = allPatients.reduce((total, p) => {
      return total + PatientsService.getOutstandingBalance(p.patient_id);
    }, 0);

    return {
      todaysAppointments: todaysAppointments.length,
      completedToday: todaysAppointments.filter(a => a.status === 'Completed').length,
      waitingToday: todaysAppointments.filter(a => a.status === 'Waiting').length,
      inTreatment: todaysAppointments.filter(a => a.status === 'In Treatment').length,
      todaysRevenue: PaymentsService.getTodaysRevenue(),
      pendingPayments: pendingPayments,
      totalPatients: allPatients.length,
      todaysFollowUps: FollowUpsService.getTodaysFollowUps().length
    };
  },

  getRecentPatients(limit = 5) {
    const patients = PatientsService.getAll();
    return patients.slice(0, limit).map(p => ({
      ...p,
      outstanding: PatientsService.getOutstandingBalance(p.patient_id),
      lastVisit: PatientsService.getLastVisitDate(p.patient_id)
    }));
  }
};

// ============================================================
// Auth Service (Simple role-based for MVP)
// ============================================================

const USERS = [
  { id: 'doctor', username: 'doctor', password: 'nisi2026', name: 'Dr. Nisi', role: 'doctor' },
  { id: 'reception', username: 'reception', password: 'front2026', name: 'Reception', role: 'receptionist' }
];

export const AuthService = {
  login(username, password) {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      const session = { ...user };
      delete session.password;
      localStorage.setItem(STORAGE_PREFIX + 'session', JSON.stringify(session));
      return session;
    }
    return null;
  },

  logout() {
    localStorage.removeItem(STORAGE_PREFIX + 'session');
  },

  getSession() {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + 'session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getSession();
  },

  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;
    
    const permissions = {
      doctor: [
        'view_dashboard', 'view_patients', 'add_patients', 'view_patient_detail',
        'view_clinical_notes', 'create_visits', 'edit_visits', 'view_visits',
        'view_payments', 'add_payments', 'view_appointments', 'create_appointments',
        'edit_appointments', 'view_followups', 'manage_records'
      ],
      receptionist: [
        'view_dashboard', 'view_patients', 'add_patients', 'view_patient_basic',
        'view_payments', 'add_payments', 'view_appointments', 'create_appointments',
        'edit_appointments'
      ]
    };

    const rolePerms = permissions[session.role] || [];
    return rolePerms.includes(permission);
  }
};

// ============================================================
// Auto-Reconciliation: Ensure every visit with amount_paid has a matching payment
// ============================================================

export function reconcilePayments() {
  const visits = getAll('visits');
  const payments = getAll('payments');
  let changed = false;

  visits.forEach(visit => {
    const visitPaid = Number(visit.amount_paid) || 0;
    if (visitPaid > 0) {
      const visitPayments = payments.filter(p => p.visit_id === visit.visit_id);
      const totalRecorded = visitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      if (totalRecorded < visitPaid) {
        const missingAmount = visitPaid - totalRecorded;
        const newPayment = {
          payment_id: generateId('PAY'),
          patient_id: visit.patient_id,
          visit_id: visit.visit_id,
          amount: missingAmount,
          payment_method: visit.payment_method || 'Cash',
          payment_date: visit.visit_date || new Date().toISOString().split('T')[0],
          notes: `Payment for visit - ${visit.treatment || visit.complaint || 'Consultation'}`,
          created_at: visit.created_at || new Date().toISOString()
        };
        payments.push(newPayment);
        GoogleSheetsService.syncSingle('createPayment', { payment: newPayment });
        changed = true;
      }
    }
  });

  if (changed) {
    saveAll('payments', payments);
  }
  return changed;
}

// ============================================================
// Seed Data for Demo
// ============================================================

export function seedDemoData() {
  // Never re-seed if Google Sheets is connected OR user explicitly cleared demo data
  if (GoogleSheetsService.isConfigured()) return;
  if (localStorage.getItem(STORAGE_PREFIX + 'demo_cleared') === 'true') return;

  // Only seed if no data exists
  if (getAll('patients').length > 0) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  // Patients
  const patients = [
    { patient_id: 'PAT_001', name: 'Rahul Kumar', phone: '9876543210', age: '32', gender: 'Male', address: 'Sector 15, Noida', allergies: 'Penicillin', medical_notes: 'Mild hypertension', emergency_contact: '9876543211', created_at: new Date(Date.now() - 30 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_002', name: 'Aisha Mirza', phone: '9812345678', age: '28', gender: 'Female', address: 'DLF Phase 2, Gurgaon', allergies: '', medical_notes: '', emergency_contact: '9812345679', created_at: new Date(Date.now() - 20 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_003', name: 'Ahmed Patel', phone: '9900112233', age: '45', gender: 'Male', address: 'Green Park, Delhi', allergies: 'Aspirin', medical_notes: 'Diabetic - Type 2', emergency_contact: '9900112234', created_at: new Date(Date.now() - 15 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_004', name: 'Priya Sharma', phone: '9988776655', age: '35', gender: 'Female', address: 'Indiranagar, Bangalore', allergies: '', medical_notes: '', emergency_contact: '', created_at: new Date(Date.now() - 10 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_005', name: 'Vikram Singh', phone: '9871234567', age: '52', gender: 'Male', address: 'Banjara Hills, Hyderabad', allergies: 'Sulfa drugs', medical_notes: 'Heart patient, on blood thinners', emergency_contact: '9871234568', created_at: new Date(Date.now() - 5 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_006', name: 'Meera Reddy', phone: '9845678901', age: '24', gender: 'Female', address: 'Koramangala, Bangalore', allergies: '', medical_notes: '', emergency_contact: '9845678902', created_at: new Date(Date.now() - 3 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_007', name: 'Sanjay Gupta', phone: '9756781234', age: '60', gender: 'Male', address: 'Model Town, Delhi', allergies: 'Lidocaine', medical_notes: 'Requires sedation for procedures', emergency_contact: '9756781235', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), is_archived: false },
    { patient_id: 'PAT_008', name: 'Fatima Khan', phone: '9634567890', age: '38', gender: 'Female', address: 'Jubilee Hills, Hyderabad', allergies: '', medical_notes: 'Pregnant - 6 months', emergency_contact: '9634567891', created_at: yesterday, is_archived: false },
  ];
  saveAll('patients', patients);

  // Visits
  const visits = [
    { visit_id: 'VIS_001', patient_id: 'PAT_001', visit_date: lastWeek, complaint: 'Tooth pain on lower right side', diagnosis: 'Dental caries - lower right molar', clinical_notes: 'Cavity observed on tooth #30. X-ray confirms decay reaching dentin.', treatment: 'Composite filling', medicines: [{ name: 'Paracetamol', dosage: '500mg', instructions: '1 tablet after food, twice daily for 3 days' }], follow_up_date: today, total_amount: 1500, amount_paid: 1500, balance: 0, created_by: 'doctor', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { visit_id: 'VIS_002', patient_id: 'PAT_002', visit_date: twoDaysAgo, complaint: 'Sensitivity to cold drinks', diagnosis: 'Enamel erosion on upper premolars', clinical_notes: 'Moderate enamel wear observed. Recommended desensitizing treatment.', treatment: 'Fluoride application', medicines: [{ name: 'Sensodyne Toothpaste', dosage: '', instructions: 'Use twice daily' }], follow_up_date: nextWeek, total_amount: 800, amount_paid: 800, balance: 0, created_by: 'doctor', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { visit_id: 'VIS_003', patient_id: 'PAT_003', visit_date: lastWeek, complaint: 'Root canal follow-up', diagnosis: 'Post root canal assessment - healing well', clinical_notes: 'Root canal treatment completed last month. Crown fitting needed.', treatment: 'Crown impression taken', medicines: [], follow_up_date: today, total_amount: 5000, amount_paid: 2000, balance: 3000, created_by: 'doctor', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { visit_id: 'VIS_004', patient_id: 'PAT_005', visit_date: yesterday, complaint: 'Bleeding gums during brushing', diagnosis: 'Gingivitis - mild to moderate', clinical_notes: 'Plaque buildup observed. Deep cleaning recommended.', treatment: 'Scaling and polishing', medicines: [{ name: 'Chlorhexidine Mouthwash', dosage: '0.2%', instructions: 'Rinse twice daily after brushing' }, { name: 'Amoxicillin', dosage: '500mg', instructions: '1 capsule 3 times daily for 5 days' }], follow_up_date: nextWeek, total_amount: 2500, amount_paid: 1500, balance: 1000, created_by: 'doctor', created_at: yesterday },
    { visit_id: 'VIS_005', patient_id: 'PAT_004', visit_date: yesterday, complaint: 'Routine cleaning', diagnosis: 'Normal dental health', clinical_notes: 'Routine checkup. Minor tartar removed.', treatment: 'Dental cleaning', medicines: [], follow_up_date: '', total_amount: 600, amount_paid: 600, balance: 0, created_by: 'doctor', created_at: yesterday },
    { visit_id: 'VIS_006', patient_id: 'PAT_006', visit_date: twoDaysAgo, complaint: 'Wisdom tooth pain', diagnosis: 'Impacted wisdom tooth - lower left', clinical_notes: 'X-ray shows partial impaction. Surgical extraction recommended.', treatment: 'Consultation - extraction planned', medicines: [{ name: 'Ibuprofen', dosage: '400mg', instructions: '1 tablet after food when needed' }], follow_up_date: today, total_amount: 500, amount_paid: 500, balance: 0, created_by: 'doctor', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
  saveAll('visits', visits);

  // Appointments
  const appointments = [
    { appointment_id: 'APT_001', patient_id: 'PAT_001', date: today, time: '09:30', reason: 'Follow-up: Filling check', dentist: 'Dr. Nisi', status: 'Confirmed', notes: '', created_at: new Date().toISOString() },
    { appointment_id: 'APT_002', patient_id: 'PAT_002', date: today, time: '10:00', reason: 'Tooth sensitivity', dentist: 'Dr. Nisi', status: 'Waiting', notes: 'Patient arrived early', created_at: new Date().toISOString() },
    { appointment_id: 'APT_003', patient_id: 'PAT_003', date: today, time: '11:30', reason: 'Crown fitting', dentist: 'Dr. Nisi', status: 'Confirmed', notes: 'Crown ready from lab', created_at: new Date().toISOString() },
    { appointment_id: 'APT_004', patient_id: 'PAT_006', date: today, time: '14:00', reason: 'Wisdom tooth extraction', dentist: 'Dr. Nisi', status: 'Confirmed', notes: 'Surgical extraction - prepare anesthesia', created_at: new Date().toISOString() },
    { appointment_id: 'APT_005', patient_id: 'PAT_007', date: today, time: '15:30', reason: 'Denture adjustment', dentist: 'Dr. Nisi', status: 'Confirmed', notes: '', created_at: new Date().toISOString() },
    { appointment_id: 'APT_006', patient_id: 'PAT_008', date: today, time: '16:30', reason: 'Routine checkup', dentist: 'Dr. Nisi', status: 'Confirmed', notes: 'Pregnant patient - avoid X-rays', created_at: new Date().toISOString() },
    { appointment_id: 'APT_007', patient_id: 'PAT_004', date: nextWeek, time: '10:00', reason: '6-month checkup', dentist: 'Dr. Nisi', status: 'Confirmed', notes: '', created_at: new Date().toISOString() },
    { appointment_id: 'APT_008', patient_id: 'PAT_005', date: nextWeek, time: '11:00', reason: 'Follow-up: Gum treatment', dentist: 'Dr. Nisi', status: 'Confirmed', notes: '', created_at: new Date().toISOString() },
  ];
  saveAll('appointments', appointments);

  // Payments
  const payments = [
    { payment_id: 'PAY_001', patient_id: 'PAT_001', visit_id: 'VIS_001', amount: 1500, payment_method: 'UPI', payment_date: lastWeek, notes: 'Filling treatment', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { payment_id: 'PAY_002', patient_id: 'PAT_002', visit_id: 'VIS_002', amount: 800, payment_method: 'Cash', payment_date: twoDaysAgo, notes: 'Fluoride treatment', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { payment_id: 'PAY_003', patient_id: 'PAT_003', visit_id: 'VIS_003', amount: 2000, payment_method: 'Card', payment_date: lastWeek, notes: 'Partial payment for crown', created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    { payment_id: 'PAY_004', patient_id: 'PAT_005', visit_id: 'VIS_004', amount: 1500, payment_method: 'UPI', payment_date: yesterday, notes: 'Scaling treatment partial', created_at: yesterday },
    { payment_id: 'PAY_005', patient_id: 'PAT_004', visit_id: 'VIS_005', amount: 600, payment_method: 'Cash', payment_date: yesterday, notes: 'Dental cleaning', created_at: yesterday },
    { payment_id: 'PAY_006', patient_id: 'PAT_006', visit_id: 'VIS_006', amount: 500, payment_method: 'UPI', payment_date: twoDaysAgo, notes: 'Consultation fee', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];
  saveAll('payments', payments);
}

// Clear all demo data so doctor can operate on empty, real data
export function clearAllData() {
  localStorage.setItem(STORAGE_PREFIX + 'demo_cleared', 'true');
  localStorage.removeItem(STORAGE_PREFIX + 'patients');
  localStorage.removeItem(STORAGE_PREFIX + 'visits');
  localStorage.removeItem(STORAGE_PREFIX + 'appointments');
  localStorage.removeItem(STORAGE_PREFIX + 'payments');
  return true;
}

// Restore demo data if desired
export function restoreDemoData() {
  localStorage.removeItem(STORAGE_PREFIX + 'demo_cleared');
  localStorage.removeItem(STORAGE_PREFIX + 'patients');
  localStorage.removeItem(STORAGE_PREFIX + 'visits');
  localStorage.removeItem(STORAGE_PREFIX + 'appointments');
  localStorage.removeItem(STORAGE_PREFIX + 'payments');
  seedDemoData();
  return true;
}

// Check if currently holding demo data
export function hasDemoData() {
  const patients = getAll('patients');
  return patients.some(p => p.patient_id === 'PAT_001');
}

// Export all CRM records as JSON backup
export function getAllDataForExport() {
  return {
    patients: getAll('patients'),
    visits: getAll('visits'),
    appointments: getAll('appointments'),
    payments: getAll('payments'),
    exported_at: new Date().toISOString(),
    version: '1.0'
  };
}

// Import records from JSON backup
export function importAllDataFromJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (data.patients && Array.isArray(data.patients)) {
      saveAll('patients', data.patients);
    }
    if (data.visits && Array.isArray(data.visits)) {
      saveAll('visits', data.visits);
    }
    if (data.appointments && Array.isArray(data.appointments)) {
      saveAll('appointments', data.appointments);
    }
    if (data.payments && Array.isArray(data.payments)) {
      saveAll('payments', data.payments);
    }
    localStorage.removeItem(STORAGE_PREFIX + 'demo_cleared');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

