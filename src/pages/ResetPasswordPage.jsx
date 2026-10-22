import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { resetPassword } from "../lib/authClient";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const login = searchParams.get("login") || "";
  const key = searchParams.get("key") || "";
  const hasValidLink = Boolean(login && key);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ login, key, password: form.password });
      setComplete(true);
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use at least 8 characters for your new Connect767 password."
      footer={<Link to="/auth/login" className="font-semibold text-primary-700 hover:text-primary-800">Back to sign in</Link>}
    >
      {complete ? (
        <div className="space-y-5 text-center" role="status">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-2xl text-primary-700">
            <i className="ri-check-line" aria-hidden="true" />
          </div>
          <p className="text-sm text-foreground-700">Your password has been reset successfully.</p>
          <Button to="/auth/login" variant="primary" className="w-full">Sign in</Button>
        </div>
      ) : !hasValidLink ? (
        <div className="space-y-4 rounded-xl border border-accent-200 bg-accent-50 p-5 text-sm text-accent-800" role="alert">
          <p>This password reset link is invalid or incomplete.</p>
          <Link to="/auth/forgot-password" className="inline-flex font-semibold text-primary-700 hover:text-primary-800">Request a new reset link</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700" role="alert">{error}</div>}
          <FormField label="New password" htmlFor="new-password" hint="At least 8 characters" required>
            <Input
              id="new-password"
              type="password"
              icon="ri-lock-line"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirm-new-password" required>
            <Input
              id="confirm-new-password"
              type="password"
              icon="ri-lock-2-line"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </FormField>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? "Resetting password…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
