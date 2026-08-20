import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import PinGate from "./PinGate";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHHMM = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("km-KH", { year: "numeric", month: "short", day: "numeric" });
};
const fmtMoney = (n) => "$" + (Number(n) || 0).toFixed(2);
const toDT = (date, time) => new Date(date + "T" + (time || "00:00").slice(0, 5) + ":00");
const diffHours = (date1, time1, date2, time2) => {
  if (!date1 || !date2) return null;
  const ms = toDT(date2, time2).getTime() - toDT(date1, time1).getTime();
  if (isNaN(ms)) return null;
  return ms / 3600000;
};
const fmtDuration = (hours) => {
  if (hours === null || isNaN(hours)) return "—";
  if (hours < 0) return "0 ម៉ោង";
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  if (days === 0) return Math.round(hours) + " ម៉ោង";
  if (rem === 0) return days + " ថ្ងៃ";
  return days + " ថ្ងៃ " + rem + " ម៉ោង";
};

/* ---------- Icons ---------- */
function PrinterIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

/* ---------- ផ្នែកតូចៗ ---------- */
function StatusPill({ status }) {
  const isActive = status === "active";
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold " + (isActive ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
      <span className={"h-1.5 w-1.5 rounded-full " + (isActive ? "bg-amber-500" : "bg-emerald-500")} />
      {isActive ? "កំពុងជួល" : "បានបិទករណី"}
    </span>
  );
}

function KeyTag({ children, plate }) {
  return (
    <div className="relative inline-flex items-center gap-2 rounded-lg border-2 border-[#0f5257]/15 bg-white px-3 py-1.5 shadow-sm">
      <div className="h-2.5 w-2.5 rounded-full bg-[#0f5257]/20 ring-1 ring-[#0f5257]/30" />
      <span className="font-mono text-sm tracking-wide text-[#0f5257]">{plate}</span>
      {children}
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#26302c]">
        {label} {required && <span className="text-[#c97b3d]">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#26302c]/50">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-[#26302c]/15 bg-white px-3.5 py-2.5 text-[15px] text-[#26302c] outline-none transition focus:border-[#0f5257] focus:ring-2 focus:ring-[#0f5257]/15";

/* ================= App ================= */
export default function App() {
  return (
    <PinGate>
      <Dashboard />
    </PinGate>
  );
}

function Dashboard() {
  const [page, setPage] = useState("register");
  const [motorcycles, setMotorcycles] = useState(null);
  const [rentals, setRentals] = useState(null);
  const [toast, setToast] = useState(null);
  const [printingRental, setPrintingRental] = useState(null);
  const [dbError, setDbError] = useState("");
  const shellRef = useRef(null);

  const fetchMotorcycles = useCallback(async () => {
    const { data, error } = await supabase.from("motorcycles").select("*").order("created_at", { ascending: false });
    if (error) { setDbError(error.message); return; }
    setMotorcycles(data || []);
  }, []);

  const fetchRentals = useCallback(async () => {
    const { data, error } = await supabase.from("rentals").select("*").order("created_at", { ascending: false });
    if (error) { setDbError(error.message); return; }
    setRentals(data || []);
  }, []);

  useEffect(() => {
    fetchMotorcycles();
    fetchRentals();
    const channel = supabase
      .channel("sn-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "motorcycles" }, fetchMotorcycles)
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, fetchRentals)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchMotorcycles, fetchRentals]);

  useEffect(() => {
    const handler = () => setPrintingRental(null);
    window.addEventListener("afterprint", handler);
    return () => window.removeEventListener("afterprint", handler);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const loading = motorcycles === null || rentals === null;

  const availableMotorcycles = useMemo(() => (motorcycles || []).filter((m) => m.status === "available"), [motorcycles]);

  const monthRevenue = useMemo(() => {
    if (!rentals) return 0;
    const ym = todayISO().slice(0, 7);
    return rentals.filter((r) => (r.start_date || "").slice(0, 7) === ym).reduce((s, r) => s + (Number(r.final_price ?? r.price) || 0), 0);
  }, [rentals]);

  const activeCount = useMemo(() => (rentals || []).filter((r) => r.status === "active").length, [rentals]);

  /* ---- បង្កើតការជួលថ្មី ---- */
  const registerRental = async (form) => {
    const { error } = await supabase.from("rentals").insert([{ ...form, status: "active" }]);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await supabase.from("motorcycles").update({ status: "rented" }).eq("id", form.motorcycle_id);
    await Promise.all([fetchRentals(), fetchMotorcycles()]);
    showToast("បានចុះឈ្មោះជួលដោយជោគជ័យ ✓");
    setPage("manage");
  };

  /* ---- កែសម្រួល / ដាក់ស្នើឡើងវិញ ---- */
  const updateRental = async (updated) => {
    const { id, ...fields } = updated;
    const { error } = await supabase.from("rentals").update(fields).eq("id", id);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await fetchRentals();
    showToast("បានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ ✓");
  };

  /* ---- បិទករណី (អាចប្រគល់មុនកាលកំណត់) ---- */
  const closeCase = async (rental, closeData) => {
    const { error } = await supabase.from("rentals").update({ status: "closed", ...closeData }).eq("id", rental.id);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await supabase.from("motorcycles").update({ status: "available" }).eq("id", rental.motorcycle_id);
    await Promise.all([fetchRentals(), fetchMotorcycles()]);
    showToast("បានបិទករណី — ម៉ូតូបានត្រឡប់មកវិញ ✓");
  };

  /* ---- ស្តុកម៉ូតូ ---- */
  const addMotorcycle = async (m) => {
    const { error } = await supabase.from("motorcycles").insert([{ ...m, status: "available" }]);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await fetchMotorcycles();
    showToast("បានបន្ថែមម៉ូតូថ្មី ✓");
  };
  const editMotorcycle = async (m) => {
    const { id, ...fields } = m;
    const { error } = await supabase.from("motorcycles").update(fields).eq("id", id);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await fetchMotorcycles();
    showToast("បានកែសម្រួលព័ត៌មានម៉ូតូ ✓");
  };
  const deleteMotorcycle = async (id) => {
    const { error } = await supabase.from("motorcycles").delete().eq("id", id);
    if (error) { showToast("មានបញ្ហា៖ " + error.message); return; }
    await fetchMotorcycles();
  };

  const triggerPrint = (rental) => {
    setPrintingRental(rental);
    setTimeout(() => window.print(), 150);
  };

  const mcById = useMemo(() => Object.fromEntries((motorcycles || []).map((m) => [m.id, m])), [motorcycles]);

  return (
    <div style={{ fontFamily: "'Noto Sans Khmer', 'Khmer OS', 'Leelawadee UI', system-ui, sans-serif" }}>
      <div ref={shellRef} style={{ display: printingRental ? "none" : "block" }} className="min-h-screen bg-[#faf6ee] text-[#26302c]">
        <header className="sticky top-0 z-30 border-b border-[#26302c]/10 bg-[#faf6ee]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f5257] text-[15px] font-bold text-white">SN</div>
              <div>
                <div className="text-[15px] font-bold leading-tight">SN ជួលម៉ូតូ សៀមរាប</div>
                <div className="text-[11px] leading-tight text-[#26302c]/50">SN - Scooter Rental Siem Reap</div>
              </div>
            </div>
            <div className="hidden gap-6 text-right sm:flex">
              <div>
                <div className="text-[11px] text-[#26302c]/50">ចំណូលខែនេះ</div>
                <div className="font-mono text-sm font-bold text-[#0f5257]">{fmtMoney(monthRevenue)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#26302c]/50">កំពុងជួល</div>
                <div className="font-mono text-sm font-bold text-[#c97b3d]">{activeCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#26302c]/50">ម៉ូតូនៅសល់</div>
                <div className="font-mono text-sm font-bold">{availableMotorcycles.length}</div>
              </div>
            </div>
          </div>
          <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2 sm:px-6">
            {[
              { id: "register", label: "ចុះឈ្មោះជួលថ្មី" },
              { id: "manage", label: "គ្រប់គ្រងទិន្នន័យ" },
              { id: "stock", label: "ស្តុកម៉ូតូ" },
            ].map((t) => (
              <button key={t.id} onClick={() => setPage(t.id)} className={"rounded-lg px-4 py-2 text-sm font-medium transition " + (page === t.id ? "bg-[#0f5257] text-white shadow-sm" : "text-[#26302c]/60 hover:bg-[#26302c]/5")}>
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {dbError && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              មិនអាចភ្ជាប់ទៅមូលដ្ឋានទិន្នន័យបានទេ៖ {dbError}. សូមពិនិត្យ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY។
            </div>
          )}
          {loading ? (
            <div className="flex h-64 items-center justify-center text-[#26302c]/40">កំពុងផ្ទុកទិន្នន័យ...</div>
          ) : page === "register" ? (
            <RegisterPage motorcycles={availableMotorcycles} onSubmit={registerRental} />
          ) : page === "manage" ? (
            <ManagePage rentals={rentals} motorcycles={motorcycles} onUpdate={updateRental} onClose={closeCase} onPrint={triggerPrint} />
          ) : (
            <StockPage motorcycles={motorcycles} onAdd={addMotorcycle} onEdit={editMotorcycle} onDelete={deleteMotorcycle} />
          )}
        </main>

        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#26302c] px-5 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {printingRental && <Receipt rental={printingRental} motorcycle={mcById[printingRental.motorcycle_id]} />}
    </div>
  );
}

/* ================= បង្កាន់ដៃសម្រាប់បោះពុម្ព ================= */
function Receipt({ rental, motorcycle }) {
  const agreed = Number(rental.price) || 0;
  const finalCharge = rental.final_price !== null && rental.final_price !== undefined ? Number(rental.final_price) : agreed;
  const deposit = Number(rental.deposit) || 0;
  return (
    <div className="mx-auto max-w-md bg-white p-8 text-[#111]" style={{ fontFamily: "'Noto Sans Khmer', 'Khmer OS', 'Leelawadee UI', system-ui, sans-serif" }}>
      <div className="text-center">
        <div className="text-lg font-bold">SN - ជួលម៉ូតូ សៀមរាប</div>
        <div className="text-xs text-gray-500">SN - Scooter Rental Siem Reap</div>
        <div className="mt-1 text-sm font-semibold">បង្កាន់ដៃជួលម៉ូតូ</div>
        <div className="text-xs text-gray-500">លេខសម្គាល់៖ {rental.id.slice(0, 8).toUpperCase()}</div>
      </div>
      <div className="my-4 border-t border-dashed border-gray-400" />
      <div className="space-y-1 text-sm">
        <Row label="ឈ្មោះអតិថិជន" value={rental.customer_name} />
        <Row label="លេខទូរស័ព្ទ" value={rental.customer_phone} />
        {rental.nationality && <Row label="សញ្ជាតិ" value={rental.nationality} />}
      </div>
      <div className="my-4 border-t border-dashed border-gray-400" />
      <div className="space-y-1 text-sm">
        <Row label="ម៉ូតូ" value={motorcycle ? motorcycle.brand + " (" + motorcycle.color + ")" : "—"} />
        <Row label="លេខផ្លាកលេខ" value={motorcycle?.plate || "—"} />
        <Row label="ប្រភេទសោ" value={motorcycle?.key_type || "—"} />
        <Row label="ប្រភេទជួល" value={rental.rental_type === "monthly" ? "ជួលខែ" : "ជួលថ្ងៃ (24ម៉ោង)"} />
      </div>
      <div className="my-4 border-t border-dashed border-gray-400" />
      <div className="space-y-1 text-sm">
        <Row label="ចាប់ផ្ដើម" value={fmtDate(rental.start_date) + " " + (rental.start_time || "").slice(0, 5)} />
        <Row label="កំណត់ប្រគល់វិញ" value={fmtDate(rental.expected_return_date) + " " + (rental.expected_return_time || "").slice(0, 5)} />
        {rental.status === "closed" && (
          <Row label="ប្រគល់មកវិញ (ពិត)" value={fmtDate(rental.actual_return_date) + " " + (rental.actual_return_time || "").slice(0, 5)} />
        )}
      </div>
      <div className="my-4 border-t border-dashed border-gray-400" />
      <div className="space-y-1 text-sm">
        <Row label="ថ្លៃជួល (កិច្ចព្រម)" value={fmtMoney(agreed)} />
        <Row label="ប្រាក់កក់" value={fmtMoney(deposit)} />
        {rental.status === "closed" && <Row label="ចំនួនទឹកប្រាក់ត្រូវបង់ជាក់ស្ដែង" value={fmtMoney(finalCharge)} bold />}
      </div>
      {rental.notes && (
        <>
          <div className="my-4 border-t border-dashed border-gray-400" />
          <div className="text-xs">
            <div className="font-semibold">កំណត់សម្គាល់៖</div>
            <div className="text-gray-600">{rental.notes}</div>
          </div>
        </>
      )}
      <div className="my-6 flex justify-between text-xs">
        <div className="text-center">
          <div className="mb-8">ហត្ថលេខាអតិថិជន</div>
          <div className="w-32 border-t border-gray-400" />
        </div>
        <div className="text-center">
          <div className="mb-8">ហត្ថលេខាអ្នកគ្រប់គ្រង</div>
          <div className="w-32 border-t border-gray-400" />
        </div>
      </div>
      <div className="mt-6 text-center text-xs text-gray-500">
        <div>បោះពុម្ពនៅ៖ {new Date().toLocaleString("km-KH")}</div>
        <div className="mt-1">សូមអរគុណ! បើកបរដោយប្រុងប្រយ័ត្ន 🙏</div>
      </div>
    </div>
  );
}
function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value || "—"}</span>
    </div>
  );
}

/* ================= ទំព័រទី ១ — ចុះឈ្មោះជួលថ្មី ================= */
function RegisterPage({ motorcycles, onSubmit }) {
  const blank = {
    customer_name: "",
    customer_phone: "",
    nationality: "",
    motorcycle_id: "",
    rental_type: "daily",
    start_date: todayISO(),
    start_time: nowHHMM(),
    expected_return_date: "",
    expected_return_time: nowHHMM(),
    price: "",
    deposit: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const durationHours = useMemo(
    () => diffHours(form.start_date, form.start_time, form.expected_return_date, form.expected_return_time),
    [form.start_date, form.start_time, form.expected_return_date, form.expected_return_time]
  );

  const submit = (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_phone || !form.motorcycle_id || !form.expected_return_date) {
      setError("សូមបំពេញព័ត៌មានដែលមានសញ្ញា * ឱ្យបានគ្រប់ជាមុនសិន");
      return;
    }
    setError("");
    onSubmit({ ...form, price: Number(form.price) || 0, deposit: Number(form.deposit) || 0 });
    setForm({ ...blank, start_time: nowHHMM(), expected_return_time: nowHHMM() });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold">ចុះឈ្មោះជួលថ្មី</h1>
        <p className="mt-1 text-sm text-[#26302c]/55">បំពេញព័ត៌មានអតិថិជន និងម៉ូតូដែលជួល រួចចុច "រក្សាទុក"</p>
      </div>
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#26302c]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ឈ្មោះអតិថិជន" required>
            <input className={inputCls} value={form.customer_name} onChange={set("customer_name")} placeholder="ឧ. John Smith" />
          </Field>
          <Field label="លេខទូរស័ព្ទ / WhatsApp" required>
            <input className={inputCls} value={form.customer_phone} onChange={set("customer_phone")} placeholder="ឧ. 012 345 678" />
          </Field>
        </div>
        <Field label="សញ្ជាតិ / ភូមិលំនៅ" hint="ស្រេចចិត្ត">
          <input className={inputCls} value={form.nationality} onChange={set("nationality")} placeholder="ឧ. បារាំង, ខ្មែរ, អាមេរិកាំង..." />
        </Field>
        <Field label="ជ្រើសរើសម៉ូតូ" required>
          <select className={inputCls} value={form.motorcycle_id} onChange={set("motorcycle_id")}>
            <option value="">— ជ្រើសរើសម៉ូតូនៅសល់ —</option>
            {motorcycles.map((m) => (
              <option key={m.id} value={m.id}>{m.brand} · {m.color} · {m.plate}</option>
            ))}
          </select>
          {motorcycles.length === 0 && <p className="mt-1.5 text-xs font-medium text-[#c97b3d]">⚠ គ្មានម៉ូតូនៅសល់ទេឥឡូវនេះ</p>}
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">ប្រភេទជួល</span>
          <div className="flex gap-2">
            {[{ v: "daily", l: "ថ្ងៃ (24ម៉ោង)" }, { v: "monthly", l: "ខែ" }].map((opt) => (
              <button type="button" key={opt.v} onClick={() => setForm((f) => ({ ...f, rental_type: opt.v }))} className={"flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition " + (form.rental_type === opt.v ? "border-[#0f5257] bg-[#0f5257] text-white" : "border-[#26302c]/15 bg-white text-[#26302c]/70 hover:border-[#0f5257]/40")}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-[#0f5257]/5 p-4">
          <div className="mb-3 text-sm font-semibold text-[#0f5257]">ថ្ងៃ និង ម៉ោងជួល</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ថ្ងៃចាប់ផ្ដើមជួល" required>
              <input type="date" className={inputCls} value={form.start_date} onChange={set("start_date")} />
            </Field>
            <Field label="ម៉ោងចាប់ផ្ដើម" required>
              <input type="time" className={inputCls} value={form.start_time} onChange={set("start_time")} />
            </Field>
            <Field label="ថ្ងៃត្រូវប្រគល់មកវិញ" required>
              <input type="date" className={inputCls} value={form.expected_return_date} onChange={set("expected_return_date")} />
            </Field>
            <Field label="ម៉ោងត្រូវប្រគល់មកវិញ" required>
              <input type="time" className={inputCls} value={form.expected_return_time} onChange={set("expected_return_time")} />
            </Field>
          </div>
          {durationHours !== null && <div className="mt-3 text-sm font-medium text-[#c97b3d]">រយៈពេលជួល៖ {fmtDuration(durationHours)}</div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ថ្លៃជួល (USD)">
            <input type="number" min="0" step="0.5" className={inputCls} value={form.price} onChange={set("price")} placeholder="0.00" />
          </Field>
          <Field label="ប្រាក់កក់ (USD)">
            <input type="number" min="0" step="0.5" className={inputCls} value={form.deposit} onChange={set("deposit")} placeholder="0.00" />
          </Field>
        </div>
        <Field label="កំណត់សម្គាល់" hint="ស្រេចចិត្ត — ឧ. លេខលិខិតឆ្លងដែន, ការខូចខាតមុននេះ">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-[#c97b3d] py-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#b56a30] active:scale-[0.99]">
          រក្សាទុក និងចុះឈ្មោះ
        </button>
      </form>
    </div>
  );
}

/* ================= ទំព័រទី ២ — គ្រប់គ្រងទិន្នន័យ ================= */
function ManagePage({ rentals, motorcycles, onUpdate, onClose, onPrint }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [closingRental, setClosingRental] = useState(null);
  const mcById = useMemo(() => Object.fromEntries(motorcycles.map((m) => [m.id, m])), [motorcycles]);

  const filtered = useMemo(() => {
    return rentals.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      const mc = mcById[r.motorcycle_id];
      return r.customer_name?.toLowerCase().includes(q) || r.customer_phone?.toLowerCase().includes(q) || mc?.plate?.toLowerCase().includes(q);
    });
  }, [rentals, filter, query, mcById]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">គ្រប់គ្រងទិន្នន័យ</h1>
          <p className="mt-1 text-sm text-[#26302c]/55">តាមដានការជួល, កែសម្រួល, និងបិទករណីនៅពេលម៉ូតូត្រឡប់មកវិញ</p>
        </div>
        <input className={inputCls + " sm:w-64"} placeholder="ស្វែងរក ឈ្មោះ / ទូរស័ព្ទ / លេខផ្លាក..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="mb-4 flex gap-2">
        {[{ v: "all", l: "ទាំងអស់" }, { v: "active", l: "កំពុងជួល" }, { v: "closed", l: "បានបិទ" }].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={"rounded-full px-4 py-1.5 text-sm font-medium transition " + (filter === f.v ? "bg-[#0f5257] text-white" : "bg-white text-[#26302c]/60 border border-[#26302c]/10")}>
            {f.l}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#26302c]/15 bg-white/50 py-16 text-center text-[#26302c]/40">មិនមានទិន្នន័យត្រូវនឹងលក្ខខណ្ឌនេះទេ</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const mc = mcById[r.motorcycle_id];
            const duration = diffHours(r.start_date, r.start_time, r.expected_return_date, r.expected_return_time);
            return (
              <div key={r.id} className="rounded-2xl border border-[#26302c]/10 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.customer_name}</span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-[#26302c]/55">{r.customer_phone}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onPrint(r)} title="បោះពុម្ពបង្កាន់ដៃ" className="flex items-center gap-1.5 rounded-lg border border-[#26302c]/15 px-3 py-1.5 text-sm font-medium hover:bg-[#26302c]/5">
                      <PrinterIcon /><span className="hidden sm:inline">បង្កាន់ដៃ</span>
                    </button>
                    <button onClick={() => setEditing(r)} className="rounded-lg border border-[#26302c]/15 px-3.5 py-1.5 text-sm font-medium hover:bg-[#26302c]/5">កែសម្រួល</button>
                    {r.status === "active" && (
                      <button onClick={() => setClosingRental(r)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">បិទករណី ✓</button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#26302c]/8 pt-3">
                  {mc && <KeyTag plate={mc.plate}><span className="text-xs text-[#26302c]/50">{mc.brand}</span></KeyTag>}
                  <div className="text-sm text-[#26302c]/70">
                    {r.rental_type === "monthly" ? "ជួលខែ" : "ជួលថ្ងៃ"} · {fmtDate(r.start_date)} {(r.start_time || "").slice(0, 5)} → {fmtDate(r.expected_return_date)} {(r.expected_return_time || "").slice(0, 5)}
                    <span className="ml-1.5 rounded bg-[#26302c]/5 px-1.5 py-0.5 text-xs font-medium">{fmtDuration(duration)}</span>
                    {r.actual_return_date && <> · ប្រគល់មកវិញ៖ {fmtDate(r.actual_return_date)} {(r.actual_return_time || "").slice(0, 5)}</>}
                  </div>
                  <div className="ml-auto text-right">
                    <div className="font-mono text-sm font-bold text-[#0f5257]">{fmtMoney(r.status === "closed" ? (r.final_price ?? r.price) : r.price)}</div>
                    {r.status === "closed" && r.final_price !== null && r.final_price !== undefined && Number(r.final_price) !== Number(r.price) && (
                      <div className="text-xs text-[#26302c]/40 line-through">{fmtMoney(r.price)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <EditModal rental={editing} motorcycles={motorcycles} onCancel={() => setEditing(null)} onSave={(u) => { onUpdate(u); setEditing(null); }} />}
      {closingRental && <CloseModal rental={closingRental} onCancel={() => setClosingRental(null)} onConfirm={(d) => { onClose(closingRental, d); setClosingRental(null); }} />}
    </div>
  );
}

function CloseModal({ rental, onCancel, onConfirm }) {
  const [returnDate, setReturnDate] = useState(todayISO());
  const [returnTime, setReturnTime] = useState(nowHHMM());
  const [finalPrice, setFinalPrice] = useState(rental.price || "");
  const [closeNote, setCloseNote] = useState("");

  const isEarly = useMemo(() => {
    const rd = toDT(returnDate, returnTime).getTime();
    const ed = toDT(rental.expected_return_date, rental.expected_return_time || "23:59").getTime();
    return !isNaN(rd) && !isNaN(ed) && rd < ed;
  }, [returnDate, returnTime, rental]);

  const actualDuration = useMemo(() => diffHours(rental.start_date, rental.start_time, returnDate, returnTime), [rental, returnDate, returnTime]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 className="mb-1 text-lg font-bold">បិទករណី — ប្រគល់ម៉ូតូមកវិញ</h2>
        <p className="mb-4 text-sm text-[#26302c]/55">បើអតិថិជនប្រគល់មកវិញមុនកាលកំណត់ សូមកែថ្ងៃ/ម៉ោង និងចំនួនទឹកប្រាក់ខាងក្រោមតាមការគិតលុយជាក់ស្តែង</p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ថ្ងៃប្រគល់មកវិញ (ជាក់ស្តែង)" required>
              <input type="date" className={inputCls} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </Field>
            <Field label="ម៉ោងប្រគល់មកវិញ" required>
              <input type="time" className={inputCls} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
            </Field>
          </div>
          <div className={"rounded-xl p-3 text-sm " + (isEarly ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>
            {isEarly ? "⚠ ប្រគល់មកវិញមុនកាលកំណត់ — " : "✓ ប្រគល់តាមកាលកំណត់ — "}
            រយៈពេលជួលជាក់ស្តែង៖ {fmtDuration(actualDuration)}
            <div className="mt-0.5 text-xs opacity-70">(កាលកំណត់ដើម៖ {fmtDate(rental.expected_return_date)} {(rental.expected_return_time || "").slice(0, 5)})</div>
          </div>
          <Field label="ថ្លៃដើម (កិច្ចព្រមព្រៀង)" hint="សម្រាប់ធ្វើជាឯកសារយោង">
            <input className={inputCls + " bg-[#26302c]/5"} value={fmtMoney(rental.price)} disabled />
          </Field>
          <Field label="ចំនួនទឹកប្រាក់ត្រូវបង់ជាក់ស្ដែង (USD)" required hint="កែតម្លៃនេះបើគិតលុយតាមថ្ងៃប្រគល់មកវិញជាក់ស្តែង">
            <input type="number" min="0" step="0.5" className={inputCls} value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
          </Field>
          <Field label="មូលហេតុ / កំណត់សម្គាល់ការបិទករណី" hint="ស្រេចចិត្ត">
            <textarea className={inputCls} rows={2} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="ឧ. អតិថិជនប្រគល់ម៉ូតូមុនកាលកំណត់ ២ថ្ងៃ" />
          </Field>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[#26302c]/15 py-2.5 font-medium">បោះបង់</button>
          <button
            onClick={() => onConfirm({
              actual_return_date: returnDate,
              actual_return_time: returnTime,
              final_price: finalPrice === "" ? rental.price : Number(finalPrice),
              close_note: closeNote,
            })}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700"
          >
            បញ្ជាក់បិទករណី ✓
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ rental, motorcycles, onCancel, onSave }) {
  const [form, setForm] = useState({ ...rental });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 className="mb-4 text-lg font-bold">កែសម្រួលការជួល</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ឈ្មោះអតិថិជន"><input className={inputCls} value={form.customer_name} onChange={set("customer_name")} /></Field>
            <Field label="លេខទូរស័ព្ទ"><input className={inputCls} value={form.customer_phone} onChange={set("customer_phone")} /></Field>
          </div>
          <Field label="ម៉ូតូ">
            <select className={inputCls} value={form.motorcycle_id} onChange={set("motorcycle_id")}>
              {motorcycles.map((m) => <option key={m.id} value={m.id}>{m.brand} · {m.color} · {m.plate}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ថ្ងៃចាប់ផ្ដើម"><input type="date" className={inputCls} value={form.start_date} onChange={set("start_date")} /></Field>
            <Field label="ម៉ោងចាប់ផ្ដើម"><input type="time" className={inputCls} value={(form.start_time || "").slice(0, 5)} onChange={set("start_time")} /></Field>
            <Field label="ថ្ងៃត្រូវប្រគល់"><input type="date" className={inputCls} value={form.expected_return_date} onChange={set("expected_return_date")} /></Field>
            <Field label="ម៉ោងត្រូវប្រគល់"><input type="time" className={inputCls} value={(form.expected_return_time || "").slice(0, 5)} onChange={set("expected_return_time")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ថ្លៃជួល (USD)"><input type="number" className={inputCls} value={form.price} onChange={set("price")} /></Field>
            <Field label="ប្រាក់កក់ (USD)"><input type="number" className={inputCls} value={form.deposit} onChange={set("deposit")} /></Field>
          </div>
          <Field label="កំណត់សម្គាល់"><textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} /></Field>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[#26302c]/15 py-2.5 font-medium">បោះបង់</button>
          <button
            onClick={() => onSave({ ...form, price: Number(form.price) || 0, deposit: Number(form.deposit) || 0 })}
            className="flex-1 rounded-xl bg-[#0f5257] py-2.5 font-semibold text-white hover:bg-[#0c4247]"
          >
            រក្សាទុកការកែប្រែ
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= ស្តុកម៉ូតូ ================= */
function StockPage({ motorcycles, onAdd, onEdit, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const blank = { brand: "", year: "", color: "", plate: "", key_type: "សោសាមញ្ញ" };
  const [form, setForm] = useState(blank);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (m) => { setForm(m); setEditingId(m.id); setShowForm(true); };

  const submit = (e) => {
    e.preventDefault();
    if (!form.brand || !form.plate) return;
    if (editingId) onEdit({ ...form, id: editingId }); else onAdd(form);
    setForm(blank); setEditingId(null); setShowForm(false);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ស្តុកម៉ូតូ</h1>
          <p className="mt-1 text-sm text-[#26302c]/55">បញ្ជីម៉ូតូទាំងអស់ក្នុងហាង — ម៉ាក, ឆ្នាំ, ពណ៌, លេខផ្លាក, ប្រភេទសោ</p>
        </div>
        <button onClick={() => { setForm(blank); setEditingId(null); setShowForm((s) => !s); }} className="rounded-xl bg-[#0f5257] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c4247]">
          {showForm ? "បិទ" : "+ បន្ថែមម៉ូតូ"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border border-[#26302c]/10 bg-white p-5 shadow-sm sm:grid-cols-2">
          <Field label="ម៉ាក / ម៉ូដែល" required><input className={inputCls} value={form.brand} onChange={set("brand")} placeholder="ឧ. Honda Click 125i" /></Field>
          <Field label="ឆ្នាំ"><input className={inputCls} value={form.year} onChange={set("year")} placeholder="ឧ. 2023" /></Field>
          <Field label="ពណ៌"><input className={inputCls} value={form.color} onChange={set("color")} placeholder="ឧ. ស" /></Field>
          <Field label="លេខផ្លាកលេខ" required><input className={inputCls} value={form.plate} onChange={set("plate")} placeholder="ឧ. 1AB-1234" /></Field>
          <Field label="ប្រភេទសោ">
            <select className={inputCls} value={form.key_type} onChange={set("key_type")}>
              <option>សោសាមញ្ញ</option><option>សោអេឡិចត្រូនិច</option><option>សោស្មាតកាត</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="w-full rounded-xl bg-[#c97b3d] py-2.5 font-bold text-white hover:bg-[#b56a30] sm:w-auto sm:px-6">
              {editingId ? "រក្សាទុកការកែប្រែ" : "រក្សាទុកម៉ូតូថ្មី"}
            </button>
          </div>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {motorcycles.map((m) => (
          <div key={m.id} className="rounded-2xl border border-[#26302c]/10 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <KeyTag plate={m.plate} />
              <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + (m.status === "available" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                {m.status === "available" ? "នៅសល់" : "កំពុងជួល"}
              </span>
            </div>
            <div className="mt-3 font-bold">{m.brand}</div>
            <div className="mt-1 text-sm text-[#26302c]/55">{m.year} · {m.color} · {m.key_type}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => startEdit(m)} className="flex-1 rounded-lg border border-[#26302c]/15 py-1.5 text-sm font-medium hover:bg-[#26302c]/5">កែសម្រួល</button>
              {m.status === "available" && (
                <button onClick={() => onDelete(m.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">លុប</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
