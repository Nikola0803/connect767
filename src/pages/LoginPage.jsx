import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { login } from "../lib/authClient";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your listings, shop orders, and uniform designs."
      footer={
        <span className="text-foreground-600">
          Don't have an account?{" "}
          <Link to="/auth/register" className="font-semibold text-primary-700 hover:text-primary-800">
            Create one
          </Link>
        </span>
      }
    >
      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            icon="ri-mail-line"
            placeholder="you@email.com"
            value={form.email}
            onChange={update("email")}
            required
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            icon="ri-lock-line"
            placeholder="••••••••"
            value={form.password}
            onChange={update("password")}
            required
            autoComplete="current-password"
          />
        </FormField>

        <div className="flex items-center justify-between text-xs font-label">
          <label className="flex items-center gap-2 text-foreground-600 cursor-pointer">
            <input type="checkbox" className="rounded border-background-300" />
            Remember me
          </label>
          <a href="#forgot-password" className="text-primary-700 hover:text-primary-800 font-semibold">
            Forgot password?
          </a>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <i className="ri-arrow-right-line" />}
        </Button>
      </form>
    </AuthLayout>
  );
}
