import React, { useState, useEffect } from "react";

const STORAGE_KEY = "sn_pin_unlocked";

export default function PinGate({ children }) {
  const requiredPin = import.meta.env.VITE_APP_PIN || "";
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!requiredPin || localStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
    setChecked(true);
  }, [requiredPin]);

  if (!checked) return null;
  if (unlocked) return children;

  const submit = (e) => {
    e.preventDefault();
    if (pin === requiredPin) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError("កូដសម្ងាត់មិនត្រឹមត្រូវទេ សូមព្យាយាមម្តងទៀត");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf6ee] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#26302c]/10 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5257] text-[15px] font-bold text-white">
            SN
          </div>
          <div className="text-lg font-bold">SN - Scooter Rental</div>
          <div className="mt-1 text-sm text-[#26302c]/55">សូមបញ្ចូលកូដសម្ងាត់ដើម្បីចូលប្រើ</div>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          className="w-full rounded-xl border border-[#26302c]/15 bg-white px-3.5 py-2.5 text-center text-lg tracking-widest outline-none focus:border-[#0f5257] focus:ring-2 focus:ring-[#0f5257]/15"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          placeholder="••••"
        />
        {error && <p className="mt-2 text-center text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-[#c97b3d] py-2.5 font-bold text-white hover:bg-[#b56a30]"
        >
          ចូលប្រើប្រាស់
        </button>
      </form>
    </div>
  );
}
