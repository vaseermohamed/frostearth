"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");

    const body: Record<string, string> = { currentPassword };
    if (newEmail) body.newEmail = newEmail;
    if (newPassword) body.newPassword = newPassword;

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus("saved");
      setCurrentPassword("");
      setNewEmail("");
      setNewPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(typeof data.error === "string" ? data.error : "Could not update account");
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Account settings</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-fog p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-fog px-3 py-2"
          />
          <p className="text-xs text-slate mt-1">Required to confirm any change below.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New email (optional)</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Leave blank to keep your current email"
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New password (optional)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep your current password"
            minLength={6}
            className="w-full rounded-md border border-fog px-3 py-2"
          />
        </div>

        {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-full bg-frost hover:opacity-90 text-white font-medium px-4 py-2 transition-opacity disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
