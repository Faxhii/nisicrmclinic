/**
 * ============================================================
 * NisiClinic Dental CRM — Google Apps Script Backend
 * ============================================================
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Name your spreadsheet: "NisiClinic CRM Database"
 * 3. Go to Extensions > Apps Script
 * 4. Replace all code in Code.gs with this entire file
 * 5. Click "Deploy" > "New deployment"
 *    - Select type: "Web app"
 *    - Description: "NisiClinic CRM API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"  <-- CRITICAL!
 * 6. Click "Deploy" and authorize the script
 * 7. Copy the "Web app URL" and paste it in NisiClinic CRM Settings
 */

const SHEET_NAMES = {
  PATIENTS: 'Patients',
  VISITS: 'Visits',
  APPOINTMENTS: 'Appointments',
  PAYMENTS: 'Payments'
};

const SCHEMAS = {
  Patients: [
    'patient_id', 'name', 'phone', 'age', 'gender', 'date_of_birth',
    'address', 'medical_notes', 'allergies', 'emergency_contact',
    'created_at', 'is_archived'
  ],
  Visits: [
    'visit_id', 'patient_id', 'visit_date', 'complaint', 'diagnosis',
    'clinical_notes', 'treatment', 'medicines_json', 'follow_up_date',
    'total_amount', 'amount_paid', 'balance', 'created_by', 'created_at'
  ],
  Appointments: [
    'appointment_id', 'patient_id', 'date', 'time', 'reason',
    'dentist', 'status', 'notes', 'created_at'
  ],
  Payments: [
    'payment_id', 'patient_id', 'visit_id', 'amount',
    'payment_method', 'payment_date', 'notes', 'created_at'
  ]
};

// Initialize sheets with header rows
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = SCHEMAS[sheetName] || [];
    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EEF2FF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// Read sheet into array of objects
function readSheetData(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip completely empty rows
    if (!row.some(cell => cell !== '' && cell !== null)) continue;

    const obj = {};
    headers.forEach((header, colIdx) => {
      let val = row[colIdx];
      // Parse medicines_json back to array/object if applicable
      if (header === 'medicines_json' && typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          obj['medicines'] = JSON.parse(val);
        } catch (e) {
          obj['medicines'] = [];
        }
      }
      obj[header] = val;
    });
    rows.push(obj);
  }
  return rows;
}

// Convert object to row values matching schema
function objectToRow(obj, schema) {
  return schema.map(header => {
    if (header === 'medicines_json') {
      return JSON.stringify(obj.medicines || []);
    }
    const val = obj[header];
    return val !== undefined && val !== null ? val : '';
  });
}

// Handle GET requests (ping, fetch all data)
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ping';

    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'NisiClinic Dental CRM Google Sheets API is connected and ready.',
        spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getAll') {
      const result = {
        patients: readSheetData(SHEET_NAMES.PATIENTS),
        visits: readSheetData(SHEET_NAMES.VISITS),
        appointments: readSheetData(SHEET_NAMES.APPOINTMENTS),
        payments: readSheetData(SHEET_NAMES.PAYMENTS)
      };
      return jsonResponse({
        status: 'success',
        data: result,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ status: 'error', message: 'Unknown GET action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// Handle POST requests (sync, append, update)
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || 'syncAll';

    // Bulk sync / push all tables
    if (action === 'syncAll' && payload.data) {
      const data = payload.data;
      if (data.patients) replaceSheetData(SHEET_NAMES.PATIENTS, data.patients, SCHEMAS.Patients);
      if (data.visits) replaceSheetData(SHEET_NAMES.VISITS, data.visits, SCHEMAS.Visits);
      if (data.appointments) replaceSheetData(SHEET_NAMES.APPOINTMENTS, data.appointments, SCHEMAS.Appointments);
      if (data.payments) replaceSheetData(SHEET_NAMES.PAYMENTS, data.payments, SCHEMAS.Payments);

      return jsonResponse({
        status: 'success',
        message: 'All collections synchronized successfully.',
        timestamp: new Date().toISOString()
      });
    }

    // Append single patient
    if (action === 'createPatient' && payload.patient) {
      const sheet = getOrCreateSheet(SHEET_NAMES.PATIENTS);
      sheet.appendRow(objectToRow(payload.patient, SCHEMAS.Patients));
      return jsonResponse({ status: 'success', item: payload.patient });
    }

    // Append single visit
    if (action === 'createVisit' && payload.visit) {
      const sheet = getOrCreateSheet(SHEET_NAMES.VISITS);
      sheet.appendRow(objectToRow(payload.visit, SCHEMAS.Visits));
      return jsonResponse({ status: 'success', item: payload.visit });
    }

    // Append single appointment
    if (action === 'createAppointment' && payload.appointment) {
      const sheet = getOrCreateSheet(SHEET_NAMES.APPOINTMENTS);
      sheet.appendRow(objectToRow(payload.appointment, SCHEMAS.Appointments));
      return jsonResponse({ status: 'success', item: payload.appointment });
    }

    // Update appointment
    if (action === 'updateAppointment' && payload.appointment_id && payload.updates) {
      updateRowById(SHEET_NAMES.APPOINTMENTS, 'appointment_id', payload.appointment_id, payload.updates, SCHEMAS.Appointments);
      return jsonResponse({ status: 'success', id: payload.appointment_id });
    }

    // Update visit
    if (action === 'updateVisit' && payload.visit_id && payload.updates) {
      updateRowById(SHEET_NAMES.VISITS, 'visit_id', payload.visit_id, payload.updates, SCHEMAS.Visits);
      return jsonResponse({ status: 'success', id: payload.visit_id });
    }

    // Delete visit
    if (action === 'deleteVisit' && payload.visit_id) {
      deleteRowById(SHEET_NAMES.VISITS, 'visit_id', payload.visit_id);
      return jsonResponse({ status: 'success', id: payload.visit_id });
    }

    // Update patient
    if (action === 'updatePatient' && payload.patient_id && payload.updates) {
      updateRowById(SHEET_NAMES.PATIENTS, 'patient_id', payload.patient_id, payload.updates, SCHEMAS.Patients);
      return jsonResponse({ status: 'success', id: payload.patient_id });
    }

    // Append single payment
    if (action === 'createPayment' && payload.payment) {
      const sheet = getOrCreateSheet(SHEET_NAMES.PAYMENTS);
      sheet.appendRow(objectToRow(payload.payment, SCHEMAS.Payments));
      return jsonResponse({ status: 'success', item: payload.payment });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// Replace entire sheet with provided dataset
function replaceSheetData(sheetName, items, schema) {
  const sheet = getOrCreateSheet(sheetName);
  sheet.clearContents();
  sheet.appendRow(schema);
  sheet.getRange(1, 1, 1, schema.length).setFontWeight('bold').setBackground('#EEF2FF');

  if (items && items.length > 0) {
    const rows = items.map(item => objectToRow(item, schema));
    sheet.getRange(2, 1, rows.length, schema.length).setValues(rows);
  }
}

// Update a row by ID
function updateRowById(sheetName, idColName, idValue, updates, schema) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const idColIdx = headers.indexOf(idColName);
  if (idColIdx === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(idValue)) {
      headers.forEach((header, colIdx) => {
        if (updates[header] !== undefined) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[header]);
        }
      });
      break;
    }
  }
}

// Delete a row by ID
function deleteRowById(sheetName, idColName, idValue) {
  const sheet = getOrCreateSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const idColIdx = headers.indexOf(idColName);
  if (idColIdx === -1) return;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIdx]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// Standard JSON response helper with proper MIME type
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
