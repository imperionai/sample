import { useState, useEffect, useCallback } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_OF_WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Storage Helpers (shared=true → accessible by ALL users) ──────────────────
async function dbGet(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function dbSet(key, val, onSync) {
  try {
    if (onSync) onSync("syncing");
    await window.storage.set(key, JSON.stringify(val), true);
    if (onSync) onSync("synced");
  } catch(e) {
    console.error(e);
    if (onSync) onSync("error");
  }
}
async function dbDel(key) {
  try { await window.storage.delete(key, true); } catch {}
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const icons = {
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  money: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  back: "M19 12H5M12 19l-7-7 7-7",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  belt: "M4 12h16M4 8h16M4 16h16",
};

// ─── Reusable UI ───────────────────────────────────────────────────────────────
const Badge = ({ children, color = "#e63946" }) => (
  <span style={{ background: color, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{children}</span>
);

const Btn = ({ onClick, children, variant = "primary", small, disabled, style = {} }) => {
  const base = { border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, transition: "all .2s", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1, ...style };
  const variants = {
    primary: { background: "linear-gradient(135deg,#e63946,#c1121f)", color: "#fff", padding: small ? "6px 14px" : "10px 22px", fontSize: small ? 13 : 15 },
    secondary: { background: "#f1f1f1", color: "#333", padding: small ? "6px 14px" : "10px 22px", fontSize: small ? 13 : 15 },
    danger: { background: "linear-gradient(135deg,#e63946,#9d0208)", color: "#fff", padding: small ? "6px 14px" : "10px 22px", fontSize: small ? 13 : 15 },
    ghost: { background: "transparent", color: "#e63946", padding: small ? "4px 10px" : "8px 16px", fontSize: small ? 13 : 14 },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.10)", padding: 24, ...style }}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{label}</label>}
    <input {...props} style={{ border: "1.5px solid #e0e0e0", borderRadius: 8, padding: "9px 14px", fontSize: 14, outline: "none", transition: "border .2s", ...props.style }} />
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 20, color: "#1a1a2e" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Icon d={icons.x} /></button>
      </div>
      {children}
    </div>
  </div>
);

// ─── App ───────────────────────────────────────────────────────────────────────
export default function KarateApp() {
  const [view, setView] = useState("home");
  const [batches, setBatches] = useState([]);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("synced"); // synced | syncing | error
  const [lastSync, setLastSync] = useState(null);

  // Modal states
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showDeleteBatch, setShowDeleteBatch] = useState(null);
  const [showDeleteStudent, setShowDeleteStudent] = useState(null);

  // Batch form
  const [batchForm, setBatchForm] = useState({ name: "", timing: "", days: [], place: "" });
  // Student form
  const [studentForm, setStudentForm] = useState({ name: "", mobile: "" });

  // Attendance state
  const [attendDate, setAttendDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState({});
  const [savedAttendance, setSavedAttendance] = useState({});
  const [attendSaved, setAttendSaved] = useState(false);

  // Fees state
  const [fees, setFees] = useState({});

  // ── Load all batches on mount
  useEffect(() => {
    (async () => {
      const data = await dbGet("batches");
      if (data) setBatches(data);
      setLoading(false);
      setLastSync(new Date());
    })();
  }, []);

  // ── Live sync: poll cloud every 15s for updates from other users
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await dbGet("batches");
        if (data) {
          setBatches(prev => {
            const prevStr = JSON.stringify(prev);
            const newStr = JSON.stringify(data);
            if (prevStr !== newStr) {
              // Also refresh currentBatch if it changed
              setCurrentBatch(cb => cb ? data.find(b => b.id === cb.id) || cb : cb);
              return data;
            }
            return prev;
          });
        }
        setSyncStatus("synced");
        setLastSync(new Date());
      } catch { setSyncStatus("error"); }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Persist batches whenever changed
  useEffect(() => {
    if (!loading) dbSet("batches", batches, setSyncStatus);
  }, [batches, loading]);

  // ── Load batch-specific data when entering a batch
  useEffect(() => {
    if (!currentBatch) return;
    (async () => {
      const a = await dbGet(`attendance_${currentBatch.id}`) || {};
      setSavedAttendance(a);
      const f = await dbGet(`fees_${currentBatch.id}`) || {};
      setFees(f);
    })();
  }, [currentBatch]);

  // ── When date changes, load existing attendance for that date
  useEffect(() => {
    if (!currentBatch) return;
    const existing = savedAttendance[attendDate];
    if (existing) setAttendance(existing);
    else {
      const init = {};
      (currentBatch.students || []).forEach(s => { init[s.id] = "present"; });
      setAttendance(init);
    }
    setAttendSaved(!!savedAttendance[attendDate]);
  }, [attendDate, currentBatch, savedAttendance]);

  // ── Helpers
  const openBatch = (batch) => { setCurrentBatch(batch); setView("batch"); };
  const goHome = () => { setView("home"); setCurrentBatch(null); };
  const syncCurrentBatch = (updated) => {
    setCurrentBatch(updated);
    setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  // ── Add Batch
  const handleAddBatch = async () => {
    if (!batchForm.name.trim()) return;
    const batch = { id: Date.now().toString(), name: batchForm.name, timing: batchForm.timing, days: batchForm.days, place: batchForm.place, students: [] };
    setBatches(prev => [...prev, batch]);
    setBatchForm({ name: "", timing: "", days: [], place: "" });
    setShowAddBatch(false);
  };

  // ── Delete Batch
  const handleDeleteBatch = async (id) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    await dbDel(`attendance_${id}`);
    await dbDel(`fees_${id}`);
    setShowDeleteBatch(null);
    if (currentBatch?.id === id) goHome();
  };

  // ── Add Student
  const handleAddStudent = () => {
    if (!studentForm.name.trim() || !studentForm.mobile.trim()) return;
    const student = { id: Date.now().toString(), name: studentForm.name, mobile: studentForm.mobile };
    const updated = { ...currentBatch, students: [...(currentBatch.students || []), student] };
    syncCurrentBatch(updated);
    setStudentForm({ name: "", mobile: "" });
    setShowAddStudent(false);
  };

  // ── Delete Student
  const handleDeleteStudent = (sid) => {
    const updated = { ...currentBatch, students: currentBatch.students.filter(s => s.id !== sid) };
    syncCurrentBatch(updated);
    setShowDeleteStudent(null);
  };

  // ── Save Attendance
  const handleSaveAttendance = async () => {
    const updated = { ...savedAttendance, [attendDate]: { ...attendance } };
    setSavedAttendance(updated);
    await dbSet(`attendance_${currentBatch.id}`, updated, setSyncStatus);
    setAttendSaved(true);
  };

  // ── Toggle Fee
  const toggleFee = async (studentId, month) => {
    const key = `${studentId}_${month}`;
    const updatedFees = { ...fees, [key]: !fees[key] };
    setFees(updatedFees);
    await dbSet(`fees_${currentBatch.id}`, updatedFees, setSyncStatus);
  };

  // ── Days toggle
  const toggleDay = (day) => {
    setBatchForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 22, color: "#e63946" }}>Loading...</div>;

  // ════════════════════ RENDER ════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)", fontFamily: "'Segoe UI',sans-serif" }}>

      {/* ── Header */}
      <header style={{ background: "rgba(0,0,0,.35)", backdropFilter: "blur(10px)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.08)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {view !== "home" && (
            <button onClick={() => view === "batch" ? goHome() : setView("batch")} style={{ background: "none", border: "none", cursor: "pointer", color: "#e63946", padding: "4px 8px" }}>
              <Icon d={icons.back} color="#e63946" />
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🥋</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>KARATE DOJO</div>
              <div style={{ color: "#e63946", fontSize: 11, fontWeight: 600, letterSpacing: 2 }}>MANAGEMENT SYSTEM</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "home" && currentBatch && <Badge>{currentBatch.name}</Badge>}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.08)", borderRadius: 20, padding: "5px 12px" }}>
            <span style={{ fontSize: 11 }}>
              {syncStatus === "synced" ? "☁️" : syncStatus === "syncing" ? "🔄" : "⚠️"}
            </span>
            <span style={{ color: syncStatus === "error" ? "#ff6b6b" : "#aef", fontSize: 11, fontWeight: 600 }}>
              {syncStatus === "synced" ? "Cloud Synced" : syncStatus === "syncing" ? "Saving..." : "Sync Error"}
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px" }}>

        {/* ════ HOME VIEW ════ */}
        {view === "home" && (
          <>
            {/* Cloud info banner */}
            <div style={{ background: "rgba(14,165,233,.15)", border: "1px solid rgba(14,165,233,.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>☁️</span>
              <div>
                <div style={{ color: "#7dd3fc", fontWeight: 700, fontSize: 14 }}>Shared Cloud Storage — Accessible by Anyone</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>All data is saved to shared cloud storage. Any device or user opening this app sees the same data. Auto-syncs every 15 seconds.</div>
              </div>
              {lastSync && <div style={{ marginLeft: "auto", color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>Last sync: {lastSync.toLocaleTimeString()}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ color: "#fff", margin: 0, fontSize: 26 }}>Training Batches</h2>
                <p style={{ color: "#aaa", margin: "4px 0 0" }}>{batches.length} active batch{batches.length !== 1 ? "es" : ""}</p>
              </div>
              <Btn onClick={() => setShowAddBatch(true)}><Icon d={icons.plus} size={16} /> Add Batch</Btn>
            </div>

            {batches.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,.06)" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🥋</div>
                <p style={{ color: "#aaa", fontSize: 16 }}>No batches yet. Create your first training batch!</p>
                <Btn onClick={() => setShowAddBatch(true)} style={{ marginTop: 8 }}><Icon d={icons.plus} size={16} /> Create Batch</Btn>
              </Card>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
                {batches.map(batch => (
                  <div key={batch.id} style={{ background: "rgba(255,255,255,.07)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", transition: "transform .2s,box-shadow .2s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(230,57,70,.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                    onClick={() => openBatch(batch)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{batch.name}</div>
                        <div style={{ color: "#e63946", fontSize: 13, marginTop: 2 }}>{batch.timing}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setShowDeleteBatch(batch); }} style={{ background: "rgba(230,57,70,.15)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#e63946" }}>
                        <Icon d={icons.trash} size={15} color="#e63946" />
                      </button>
                    </div>
                    <div style={{ color: "#bbb", fontSize: 13 }}>📍 {batch.place || "—"}</div>
                    <div style={{ color: "#bbb", fontSize: 13, marginTop: 4 }}>📅 {batch.days?.join(", ") || "—"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                      <Badge color="#0f3460">{batch.students?.length || 0} Students</Badge>
                      <span style={{ color: "#e63946", fontSize: 13, fontWeight: 600 }}>Open →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════ BATCH VIEW ════ */}
        {view === "batch" && currentBatch && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ color: "#fff", margin: 0, fontSize: 24 }}>{currentBatch.name}</h2>
              <div style={{ color: "#aaa", fontSize: 14, marginTop: 4 }}>⏰ {currentBatch.timing} &nbsp;|&nbsp; 📍 {currentBatch.place} &nbsp;|&nbsp; 📅 {currentBatch.days?.join(", ")}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
              {[
                { label: "Students", icon: "👥", sub: `${currentBatch.students?.length || 0} enrolled`, view: "students", color: "#0f3460" },
                { label: "Attendance", icon: "📋", sub: "Mark & track", view: "attendance", color: "#2d6a4f" },
                { label: "Fees", icon: "💰", sub: "Monthly tracking", view: "fees", color: "#7b2d8b" },
              ].map(item => (
                <div key={item.view} onClick={() => setView(item.view)}
                  style={{ background: `linear-gradient(135deg,${item.color},rgba(255,255,255,.05))`, borderRadius: 16, padding: 28, cursor: "pointer", border: "1px solid rgba(255,255,255,.12)", textAlign: "center", transition: "transform .2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
                  onMouseLeave={e => e.currentTarget.style.transform = ""}>
                  <div style={{ fontSize: 38 }}>{item.icon}</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, marginTop: 10 }}>{item.label}</div>
                  <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ STUDENTS VIEW ════ */}
        {view === "students" && currentBatch && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#fff", margin: 0 }}>👥 Students — {currentBatch.name}</h2>
              <Btn onClick={() => setShowAddStudent(true)}><Icon d={icons.plus} size={16} /> Add Student</Btn>
            </div>
            {(!currentBatch.students || currentBatch.students.length === 0) ? (
              <Card style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 44 }}>🥋</div>
                <p style={{ color: "#888" }}>No students yet. Add your first student!</p>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {currentBatch.students.map((s, i) => (
                  <Card key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ background: "linear-gradient(135deg,#e63946,#c1121f)", color: "#fff", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{s.name}</div>
                        <div style={{ color: "#888", fontSize: 13 }}>📱 {s.mobile}</div>
                      </div>
                    </div>
                    <Btn variant="danger" small onClick={() => setShowDeleteStudent(s)}><Icon d={icons.trash} size={14} /> Remove</Btn>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════ ATTENDANCE VIEW ════ */}
        {view === "attendance" && currentBatch && (
          <>
            <h2 style={{ color: "#fff", margin: "0 0 20px" }}>📋 Attendance — {currentBatch.name}</h2>
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>Select Date</label>
                  <input type="date" value={attendDate} onChange={e => { setAttendDate(e.target.value); setAttendSaved(false); }}
                    style={{ border: "1.5px solid #e0e0e0", borderRadius: 8, padding: "9px 14px", fontSize: 14, width: "100%", boxSizing: "border-box" }} />
                </div>
                {attendSaved && <Badge color="#2d6a4f">✓ Saved</Badge>}
              </div>

              {(!currentBatch.students || currentBatch.students.length === 0) ? (
                <p style={{ color: "#888", textAlign: "center", padding: 20 }}>No students in this batch. Add students first.</p>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <Btn variant="secondary" small onClick={() => { const a = {}; currentBatch.students.forEach(s => a[s.id] = "present"); setAttendance(a); }}>✅ Mark All Present</Btn>
                    <Btn variant="secondary" small onClick={() => { const a = {}; currentBatch.students.forEach(s => a[s.id] = "absent"); setAttendance(a); }}>❌ Mark All Absent</Btn>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {currentBatch.students.map(s => {
                      const status = attendance[s.id] || "present";
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: status === "present" ? "rgba(45,106,79,.1)" : "rgba(230,57,70,.08)", border: `1.5px solid ${status === "present" ? "#2d6a4f" : "#e63946"}` }}>
                          <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{s.name}</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setAttendance(a => ({ ...a, [s.id]: "present" }))} style={{ background: status === "present" ? "#2d6a4f" : "#f0f0f0", color: status === "present" ? "#fff" : "#555", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>✅ Present</button>
                            <button onClick={() => setAttendance(a => ({ ...a, [s.id]: "absent" }))} style={{ background: status === "absent" ? "#e63946" : "#f0f0f0", color: status === "absent" ? "#fff" : "#555", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>❌ Absent</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Btn onClick={handleSaveAttendance} style={{ marginTop: 20, width: "100%", justifyContent: "center" }}>💾 Save Attendance for {attendDate}</Btn>
                </>
              )}
            </Card>

            {/* Past attendance records */}
            {Object.keys(savedAttendance).length > 0 && (
              <Card>
                <h3 style={{ margin: "0 0 14px", color: "#1a1a2e" }}>📅 Past Attendance Records</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(savedAttendance).sort((a, b) => b[0].localeCompare(a[0])).map(([date, record]) => {
                    const total = Object.keys(record).length;
                    const present = Object.values(record).filter(v => v === "present").length;
                    return (
                      <div key={date} onClick={() => setAttendDate(date)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "#f8f8f8", cursor: "pointer", border: "1px solid #e0e0e0" }}>
                        <span style={{ fontWeight: 600 }}>{date}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Badge color="#2d6a4f">{present} Present</Badge>
                          <Badge color="#e63946">{total - present} Absent</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ════ FEES VIEW ════ */}
        {view === "fees" && currentBatch && (
          <>
            <h2 style={{ color: "#fff", margin: "0 0 20px" }}>💰 Fees — {currentBatch.name}</h2>
            {(!currentBatch.students || currentBatch.students.length === 0) ? (
              <Card style={{ textAlign: "center", padding: 40 }}><p style={{ color: "#888" }}>No students in this batch.</p></Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {currentBatch.students.map(s => {
                  const paidCount = MONTHS.filter(m => fees[`${s.id}_${m}`]).length;
                  return (
                    <Card key={s.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{s.name}</div>
                          <div style={{ color: "#888", fontSize: 13 }}>📱 {s.mobile}</div>
                        </div>
                        <Badge color={paidCount === 12 ? "#2d6a4f" : paidCount > 0 ? "#e07c00" : "#e63946"}>{paidCount}/12 Paid</Badge>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(95px,1fr))", gap: 8 }}>
                        {MONTHS.map(month => {
                          const paid = !!fees[`${s.id}_${month}`];
                          return (
                            <button key={month} onClick={() => toggleFee(s.id, month)}
                              style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${paid ? "#2d6a4f" : "#e0e0e0"}`, background: paid ? "rgba(45,106,79,.12)" : "#fafafa", cursor: "pointer", fontWeight: 600, fontSize: 12, color: paid ? "#2d6a4f" : "#888", transition: "all .15s" }}>
                              {paid ? "✅" : "⬜"} {month.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

      </main>

      {/* ════ MODALS ════ */}
      {showAddBatch && (
        <Modal title="🥋 Add New Batch" onClose={() => setShowAddBatch(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Batch Name *" placeholder="e.g. Morning Beginners" value={batchForm.name} onChange={e => setBatchForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Timing" placeholder="e.g. 7:00 AM – 8:00 AM" value={batchForm.timing} onChange={e => setBatchForm(p => ({ ...p, timing: e.target.value }))} />
            <Input label="Place" placeholder="e.g. Main Dojo Hall" value={batchForm.place} onChange={e => setBatchForm(p => ({ ...p, place: e.target.value }))} />
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 8 }}>Training Days</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DAYS_OF_WEEK.map(d => (
                  <button key={d} onClick={() => toggleDay(d)} style={{ padding: "6px 14px", borderRadius: 20, border: `2px solid ${batchForm.days.includes(d) ? "#e63946" : "#e0e0e0"}`, background: batchForm.days.includes(d) ? "rgba(230,57,70,.1)" : "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, color: batchForm.days.includes(d) ? "#e63946" : "#888" }}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn onClick={handleAddBatch} style={{ flex: 1, justifyContent: "center" }}>Create Batch</Btn>
              <Btn variant="secondary" onClick={() => setShowAddBatch(false)} style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showAddStudent && (
        <Modal title="👤 Add Student" onClose={() => setShowAddStudent(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Full Name *" placeholder="Student name" value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Mobile Number *" placeholder="10-digit number" value={studentForm.mobile} onChange={e => setStudentForm(p => ({ ...p, mobile: e.target.value }))} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn onClick={handleAddStudent} style={{ flex: 1, justifyContent: "center" }}>Add Student</Btn>
              <Btn variant="secondary" onClick={() => setShowAddStudent(false)} style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteBatch && (
        <Modal title="⚠️ Delete Batch" onClose={() => setShowDeleteBatch(null)}>
          <p style={{ color: "#555" }}>Are you sure you want to delete <strong>{showDeleteBatch.name}</strong>? This will also delete all students, attendance and fee records.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="danger" onClick={() => handleDeleteBatch(showDeleteBatch.id)} style={{ flex: 1, justifyContent: "center" }}>Yes, Delete</Btn>
            <Btn variant="secondary" onClick={() => setShowDeleteBatch(null)} style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {showDeleteStudent && (
        <Modal title="⚠️ Remove Student" onClose={() => setShowDeleteStudent(null)}>
          <p style={{ color: "#555" }}>Remove <strong>{showDeleteStudent.name}</strong> from this batch?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="danger" onClick={() => handleDeleteStudent(showDeleteStudent.id)} style={{ flex: 1, justifyContent: "center" }}>Yes, Remove</Btn>
            <Btn variant="secondary" onClick={() => setShowDeleteStudent(null)} style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
