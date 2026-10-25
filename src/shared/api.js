const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ── Mock Initial Database ───────────────────────────────────────────────────
const DEFAULT_DOCTORS = [
  {
    id: 1,
    username: "dr_smith",
    password: "password123",
    name: "Dr. Alan Smith",
    department: "Neurology"
  },
  {
    id: 2,
    username: "dr_jones",
    password: "password123",
    name: "Dr. Sarah Jones",
    department: "Intensive Care"
  }
];

const DEFAULT_PATIENTS = [
  {
    id: 1,
    name: "John Doe",
    roomNumber: "101",
    room_number: "101", // handle both namings
    age: 62,
    date_of_birth: "1964-05-12",
    diagnosis: "Severe ALS, motor impairment",
    condition: "ALS",
    alertStatus: "green",
    hasActiveAnomaly: false,
    hasUnreadReport: false,
    password: "password1",
    checkins: [], // list of dates completed today
    doctorId: 1,  // Assigned to Dr. Alan Smith (doctor1)
  },
  {
    id: 2,
    name: "Sarah Jenkins",
    roomNumber: "204",
    room_number: "204",
    age: 71,
    date_of_birth: "1955-08-22",
    diagnosis: "Brainstem stroke, locked-in syndrome",
    condition: "Stroke",
    alertStatus: "red",
    hasActiveAnomaly: true,
    hasUnreadReport: true,
    password: "password1",
    checkins: [],
    doctorId: 2,  // Assigned to Dr. Sarah Jones (doctor2)
  },
  {
    id: 3,
    name: "Robert Chen",
    roomNumber: "312",
    room_number: "312",
    age: 45,
    date_of_birth: "1981-11-03",
    diagnosis: "C4 Spinal Cord Injury",
    condition: "Spinal Injury",
    alertStatus: "amber",
    hasActiveAnomaly: false,
    hasUnreadReport: true,
    password: "", // Empty to demonstrate first-time patient password setup!
    checkins: [],
    doctorId: 1,  // Assigned to Dr. Alan Smith (doctor1)
  }
];

function initMockStorage() {
  if (!localStorage.getItem("ispeak_mock_doctors")) {
    localStorage.setItem("ispeak_mock_doctors", JSON.stringify(DEFAULT_DOCTORS));
  }
  
  const storedPatients = localStorage.getItem("ispeak_mock_patients");
  if (!storedPatients) {
    localStorage.setItem("ispeak_mock_patients", JSON.stringify(DEFAULT_PATIENTS));
  } else {
    // If the mock patients exist but don't have doctorId, migrate them
    try {
      const parsed = JSON.parse(storedPatients);
      if (parsed.length > 0 && parsed[0].doctorId === undefined) {
        const migrated = parsed.map(p => {
          if (p.id === 1) p.doctorId = 1;
          else if (p.id === 2) p.doctorId = 2;
          else if (p.id === 3) p.doctorId = 1;
          else p.doctorId = 1;
          return p;
        });
        localStorage.setItem("ispeak_mock_patients", JSON.stringify(migrated));
      }
    } catch (_) {}
  }
  
  if (!localStorage.getItem("ispeak_mock_reports")) {
    localStorage.setItem("ispeak_mock_reports", JSON.stringify([]));
  }
  if (!localStorage.getItem("ispeak_mock_sos")) {
    localStorage.setItem("ispeak_mock_sos", JSON.stringify([]));
  }
}

initMockStorage();

// Helper to check if server is active (default is false if fetch fails)
let isBackendOnline = false;

// We try to probe the backend occasionally, or simply use fallback upon fetch failure
async function req(method, path, body) {
  const token = localStorage.getItem("ispeak_token");

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),

      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    isBackendOnline = true;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  } catch (err) {
    // If it's a network error (server is offline), trigger fallback seamlessly!
    if (err.name === "TypeError" || err.message.includes("Failed to fetch") || err.message.includes("HTTP 5")) {
      isBackendOnline = false;
      return handleFallback(method, path, body);
    }
    throw err;
  }
}

// ── Fallback Handler ──────────────────────────────────────────────────────────
function handleFallback(method, path, body) {
  console.log(`[API Fallback] ${method} ${path}`, body);
  const patients = JSON.parse(localStorage.getItem("ispeak_mock_patients") || "[]");
  const reports = JSON.parse(localStorage.getItem("ispeak_mock_reports") || "[]");
  const sosAlerts = JSON.parse(localStorage.getItem("ispeak_mock_sos") || "[]");

  // Determine current doctor ID from token if logged in
  const token = localStorage.getItem("ispeak_token");
  let currentDoctorId = null;
  if (token && token.startsWith("mock_doctor_token_")) {
    currentDoctorId = parseInt(token.split("_")[3]);
  }

  // 1. GET /patients/
  if (method === "GET" && path === "/patients/") {
    // Sync names
    const list = patients.map(p => ({
      ...p,
      roomNumber: p.roomNumber || p.room_number,
      room_number: p.roomNumber || p.room_number,
    }));
    if (currentDoctorId !== null) {
      return list.filter(p => p.doctorId === currentDoctorId);
    }
    return list;
  }

  // 2. GET /patients/:id/
  if (method === "GET" && path.startsWith("/patients/") && path.endsWith("/")) {
    const id = parseInt(path.split("/")[2]);
    const p = patients.find(x => x.id === id);
    if (!p) throw new Error("Patient not found");
    return p;
  }

  // 3. POST /patients/
  if (method === "POST" && path === "/patients/") {
    const newId = patients.length > 0 ? Math.max(...patients.map(p => p.id)) + 1 : 1;
    const finalId = body.id ? parseInt(body.id) : newId;
    const newP = {
      id: finalId,
      name: body.name,
      roomNumber: body.room_number || body.roomNumber,
      room_number: body.room_number || body.roomNumber,
      age: body.age || 30,
      date_of_birth: body.date_of_birth || "1996-01-01",
      diagnosis: body.condition || body.diagnosis || "Under Observation",
      condition: body.condition || body.diagnosis || "ALS",
      alertStatus: "green",
      hasActiveAnomaly: false,
      hasUnreadReport: false,
      password: body.password || "12345", // save password from dashboard
      checkins: [],
      doctorId: currentDoctorId || 1, // associate with the logged-in doctor
    };
    patients.push(newP);
    localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
    return newP;
  }

  // 3b. DELETE /patients/:id/
  if (method === "DELETE" && path.startsWith("/patients/")) {
    const id = parseInt(path.split("/")[2]);
    const pIdx = patients.findIndex(x => x.id === id);
    if (pIdx !== -1) {
      patients.splice(pIdx, 1);
      localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
    }
    // Clean up associated reports and SOS alerts for this patient in mock DB
    const filteredReports = reports.filter(r => r.patientId !== id);
    localStorage.setItem("ispeak_mock_reports", JSON.stringify(filteredReports));
    const filteredSos = sosAlerts.filter(s => s.patientId !== id);
    localStorage.setItem("ispeak_mock_sos", JSON.stringify(filteredSos));
    return { success: true };
  }

  // 4. GET /patients/:id/trends/
  if (method === "GET" && path.includes("/trends/")) {
    const id = parseInt(path.split("/")[2]);
    const pReports = reports.filter(r => r.patientId === id).slice(-30);
    const trends = pReports.map(r => ({
      date: new Date(r.timestamp).toISOString().split("T")[0],
      bodyPart: r.bodyPart,
      severity: r.severity,
    }));
    return { patientId: id, trends };
  }

  // 5. GET /reports/
  if (method === "GET" && path.startsWith("/reports/")) {
    const urlParams = new URLSearchParams(path.split("?")[1] || "");
    const patientId = parseInt(urlParams.get("patient_id"));
    if (patientId) {
      return reports.filter(r => r.patientId === patientId).reverse();
    }
    return reports.slice().reverse();
  }

  // 6. POST /reports/
  if (method === "POST" && path === "/reports/") {
    const newId = reports.length + 1;
    const patientId = parseInt(body.patientId);

    // Auto generate clinical note simulation
    let note = "Patient reported feeling " + body.emotion + ". ";
    if (body.bodyPart) note += "A localized pain in " + body.bodyPart.replace("_", " ") + " was logged. ";
    if (body.severity) note += `Intensity graded as ${body.severity}/5. `;
    if (body.painType) note += "Pain quality described as " + body.painType.replace("_", " ") + ". ";
    if (body.severity >= 5 && body.emotion === "pain") {
      note += "CRITICAL: Immediate assessment recommended.";
    } else {
      note += "Standard supportive care advised.";
    }

    const newR = {
      id: newId,
      patientId,
      emotion: body.emotion,
      bodyPart: body.bodyPart,
      severity: parseInt(body.severity),
      painType: body.painType,
      clinicalNote: note,
      isAnomaly: parseInt(body.severity) >= 5 && body.emotion === "pain",
      anomalyMessage: (parseInt(body.severity) >= 5 && body.emotion === "pain") ? "High severity pain alert detected." : "",
      timestamp: new Date().toISOString(),
    };

    reports.push(newR);
    localStorage.setItem("ispeak_mock_reports", JSON.stringify(reports));

    // Update patient status in mock
    const pIdx = patients.findIndex(x => x.id === patientId);
    if (pIdx !== -1) {
      patients[pIdx].lastReportTimestamp = newR.timestamp;
      patients[pIdx].hasUnreadReport = true;
      patients[pIdx].hasActiveAnomaly = newR.isAnomaly;
      patients[pIdx].alertStatus = newR.isAnomaly ? "red" : newR.severity >= 4 ? "red" : newR.severity === 3 ? "amber" : "green";

      // Update checkins
      const today = new Date().toDateString();
      if (!patients[pIdx].checkins) patients[pIdx].checkins = [];
      if (!patients[pIdx].checkins.includes(today)) {
        patients[pIdx].checkins.push(today);
      }
      localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
    }

    mockWSBroadcast("newReport", { patientId });
    return newR;
  }

  // 7. GET /sos/?acknowledged=false
  if (method === "GET" && path.startsWith("/sos/")) {
    return sosAlerts.filter(s => !s.acknowledged).reverse();
  }

  // 8. POST /sos/
  if (method === "POST" && path === "/sos/") {
    const patientId = parseInt(body.patientId);
    const p = patients.find(x => x.id === patientId);
    const newId = sosAlerts.length + 1;
    const newSOS = {
      id: newId,
      patientId,
      patientName: p ? p.name : `Patient #${patientId}`,
      roomNumber: p ? (p.roomNumber || p.room_number) : "—",
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    sosAlerts.push(newSOS);
    localStorage.setItem("ispeak_mock_sos", JSON.stringify(sosAlerts));

    // Update patient alert status to red
    if (p) {
      const pIdx = patients.findIndex(x => x.id === patientId);
      if (pIdx !== -1) {
        patients[pIdx].alertStatus = "red";
        localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
      }
    }

    mockWSBroadcast("sosAlert", newSOS);
    return newSOS;
  }

  // 9. PATCH /sos/:id/
  if (method === "PATCH" && path.startsWith("/sos/")) {
    const id = parseInt(path.split("/")[2]);
    const idx = sosAlerts.findIndex(x => x.id === id);
    if (idx !== -1) {
      sosAlerts[idx].acknowledged = true;
      localStorage.setItem("ispeak_mock_sos", JSON.stringify(sosAlerts));

      // Reset patient alert status if no active anomalies
      const pId = sosAlerts[idx].patientId;
      const pIdx = patients.findIndex(x => x.id === pId);
      if (pIdx !== -1) {
        patients[pIdx].alertStatus = "green"; // fallback to safe
        localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
      }
    }
    return { id, acknowledged: true };
  }

  throw new Error(`Method ${method} on path ${path} not mock-implemented.`);
}

// ── Doctor Auth ─────────────────────────────────────────────────────────────
export async function login(username, password) {
  initMockStorage();
  try {
    const data = await req("POST", "/auth/login/", { username, password });
    localStorage.setItem("ispeak_token", data.access);
    localStorage.setItem("ispeak_role", "doctor");
    return data;
  } catch (err) {
    if (!isBackendOnline) {
      // Mock login for offline demo
      const doctors = JSON.parse(localStorage.getItem("ispeak_mock_doctors") || "[]");
      const doctor = doctors.find(d => d.username === username && d.password === password);

      if (doctor) {
        localStorage.setItem("ispeak_token", `mock_doctor_token_${doctor.id}`);
        localStorage.setItem("ispeak_role", "doctor");
        return { token: `mock_doctor_token_${doctor.id}`, doctor };
      }
      throw new Error("Invalid username or password");
    }
    throw err;
  }
}

export function logout() {
  localStorage.removeItem("ispeak_token");
  localStorage.removeItem("ispeak_role");
  localStorage.removeItem("ispeak_patient_id");
}

export function isLoggedIn() {
  return !!localStorage.getItem("ispeak_token");
}

// ── Patient Auth & Roster-Sync ───────────────────────────────────────────────
export async function patientLogin(patientIdStr, password) {
  const patientId = parseInt(patientIdStr);

  try {
    // Fetch all patients from backend
    const patients = await getPatients();

    // Find matching patient
    const patient = patients.find(
      p => p.patient_id === patientIdStr
    );



    if (!patient) {
      throw new Error("Invalid Patient ID");
    }

    // First-time setup
    // if (!patient.password) {
    //   return {
    //     setupNeeded: true,
    //     patient
    //   };
    // }

    // // Password validation
    // if (patient.password !== password) {
    //   throw new Error("Incorrect Password");
    // }

    // Real login success
    localStorage.setItem("ispeak_role", "patient");
    localStorage.setItem("ispeak_patient_id", String(patient.id));

    return {
      success: true,
      patient
    };

  } catch (err) {
    throw err;
  }
}

// Patient password initialization
export async function initializePatientPassword(patientIdStr, newPassword) {
  const patientId = parseInt(patientIdStr);
  const patients = JSON.parse(localStorage.getItem("ispeak_mock_patients") || "[]");

  const idx = patients.findIndex(p => p.id === patientId);
  if (idx === -1) throw new Error("Patient not found.");

  patients[idx].password = newPassword;
  localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));

  // Log them in immediately
  localStorage.setItem("ispeak_token", `mock_patient_token_${patientId}`);
  localStorage.setItem("ispeak_role", "patient");
  localStorage.setItem("ispeak_patient_id", String(patientId));
  return { success: true, patient: patients[idx] };
}

// ── Patients ─────────────────────────────────────────────────────────────────
export const getPatients = () => req("GET", "/patients/");
export const getPatient = (id) => req("GET", `/patients/${id}/`);
export const deletePatient = (id) => req("DELETE", `/patients/${id}/`);

export async function createPatient(data) {
  // Save passwords locally for the patient even in online mode, so they can log in
  const p = await req("POST", "/patients/", data);

  // Determine current doctor ID from token if we want to save doctorId locally
  const token = localStorage.getItem("ispeak_token");
  let currentDoctorId = null;
  if (token && token.startsWith("mock_doctor_token_")) {
    currentDoctorId = parseInt(token.split("_")[3]);
  }

  // Roster alignment: save password in local storage database
  const patients = JSON.parse(localStorage.getItem("ispeak_mock_patients") || "[]");
  const idx = patients.findIndex(x => x.id === p.id);
  if (idx !== -1) {
    patients[idx].password = data.password || "12345";
    if (currentDoctorId) patients[idx].doctorId = currentDoctorId;
    localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
  } else {
    patients.push({
      ...p,
      password: data.password || "12345",
      checkins: [],
      doctorId: currentDoctorId || 1,
    });
    localStorage.setItem("ispeak_mock_patients", JSON.stringify(patients));
  }
  return p;
}

export const getPatientTrends = (id) => req("GET", `/patients/${id}/trends/`);

// ── Reports ──────────────────────────────────────────────────────────────────
export const createReport = (data) => req("POST", "/reports/", data);
export const getReports = (patientId) =>
  req("GET", `/reports/${patientId ? `?patient_id=${patientId}` : ""}`);

// ── SOS ──────────────────────────────────────────────────────────────────────
export const createSOS = (data) => req("POST", "/sos/", data);
export const getSOSAlerts = () => req("GET", "/sos/?acknowledged=false");
export const acknowledgeAlert = (id) => req("PATCH", `/sos/${id}/`, { acknowledged: true });

// ── Calibration ──────────────────────────────────────────────────────────────
export const saveCalibration = (data) => req("POST", "/calibration/", data);

// ── WebSocket ────────────────────────────────────────────────────────────────
export function connectDashboardWS(onMessage) {
  const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
  const token = localStorage.getItem("ispeak_token");

  // Standard WebSocket that fails gracefully offline
  const ws = new WebSocket(`${WS_BASE}/ws/dashboard/`);

  ws.onopen = () => console.log("[WS] Connected to dashboard");
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (_) { }
  };
  ws.onerror = (e) => {
    console.warn("[WS Offline] Dashboard live connection bypassed. Using polling fallback.");
  };
  ws.onclose = () => console.log("[WS] Disconnected");

  // Mock WS broadcaster trigger for offline testing (same tab)
  const handleLocal = (e) => onMessage(e.detail);
  window.addEventListener("mock-ws-event", handleLocal);

  // Mock WS broadcaster trigger for offline testing (cross-tab)
  const handleStorage = (e) => {
    if (e.key === "ispeak_mock_ws" && e.newValue) {
      try {
        const msg = JSON.parse(e.newValue);
        onMessage(msg);
      } catch (_) { }
    }
  };
  window.addEventListener("storage", handleStorage);

  const originalClose = ws.close.bind(ws);
  ws.close = () => {
    window.removeEventListener("mock-ws-event", handleLocal);
    window.removeEventListener("storage", handleStorage);
    originalClose();
  };

  return ws;
}

// Helper to broadcast event offline so active dashboard tab gets real-time refresh
export function mockWSBroadcast(type, data) {
  const detail = { type, ...data };
  // Dispatch locally (same tab)
  window.dispatchEvent(new CustomEvent("mock-ws-event", { detail }));

  // Dispatch globally (cross tab)
  try {
    localStorage.setItem("ispeak_mock_ws", JSON.stringify({ ...detail, _ts: Date.now() }));
  } catch (_) { }
}

