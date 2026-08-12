import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import DemoModeNotice from "../components/DemoModeNotice";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { login, register } from "../lib/authClient";
import { isLiveApi } from "../lib/config";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.endsWith("/login") ? "login" : "register");

  const switchTab = (next) => {
    setTab(next);
    navigate(`/auth/${next}`, { replace: true });
  };

  return (
    <AuthLayout
      title={
        tab === "login" ? (
          "Welcome back"
        ) : (
          <span className="inline-flex items-center justify-center gap-2">
            <i className="ri-store-2-line" /> List your business
          </span>
        )
      }
      subtitle={
        tab === "login"
          ? "Sign in to manage your listings, shop orders, and uniform designs."
          : "Join Connect767 directory and reach locals"
      }
    >
      <div className="inline-flex w-full items-center gap-1 p-1 mb-6 bg-background-100 rounded-lg border border-background-200/70">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 py-2 text-sm font-semibold rounded-md cursor-pointer transition-colors ${
            tab === "login"
              ? "bg-background-50 text-foreground-950 shadow-sm"
              : "text-foreground-500 hover:text-foreground-800"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 py-2 text-sm font-semibold rounded-md cursor-pointer transition-colors ${
            tab === "register"
              ? "bg-background-50 text-foreground-950 shadow-sm"
              : "text-foreground-500 hover:text-foreground-800"
          }`}
        >
          Register
        </button>
      </div>

      {!isLiveApi && <DemoModeNotice className="mb-5" />}

      {tab === "login" ? <LoginForm /> : <RegisterForm />}
    </AuthLayout>
  );
}

function LoginForm() {
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
      navigate(location.state?.from || "/");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5" />
          {error}
        </div>
      )}

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
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    if (!form.agree) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    try {
      // Every registration is a business account — Connect767 doesn't have a
      // separate shopper/customer account type. Shop checkout stays guest.
      await register({ ...form, accountType: "business" });
      navigate("/listings/submit");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5" />
          {error}
        </div>
      )}

      <FormField label="Business or your name" htmlFor="name">
        <Input
          id="name"
          icon="ri-user-line"
          placeholder="Cocoa Palm Bistro"
          value={form.name}
          onChange={update("name")}
          required
          autoComplete="name"
        />
      </FormField>

      <FormField label="Email" htmlFor="reg-email">
        <Input
          id="reg-email"
          type="email"
          icon="ri-mail-line"
          placeholder="you@email.com"
          value={form.email}
          onChange={update("email")}
          required
          autoComplete="email"
        />
      </FormField>

      <FormField label="Password" htmlFor="reg-password" hint="At least 8 characters">
        <Input
          id="reg-password"
          type="password"
          icon="ri-lock-line"
          placeholder="••••••••"
          minLength={8}
          value={form.password}
          onChange={update("password")}
          required
          autoComplete="new-password"
        />
      </FormField>

      <FormField label="Verify password" htmlFor="reg-confirm-password" required>
        <Input
          id="reg-confirm-password"
          type="password"
          icon="ri-lock-2-line"
          placeholder="••••••••"
          minLength={8}
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          required
          autoComplete="new-password"
        />
      </FormField>

      <label className="flex items-start gap-2.5 text-xs font-label text-foreground-600 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 rounded border-background-300"
          checked={form.agree}
          onChange={update("agree")}
        />
        <span>
          I agree to the{" "}
          <a href="#terms" className="text-primary-700 hover:text-primary-800 font-semibold">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary-700 hover:text-primary-800 font-semibold">
            Privacy Policy
          </a>
        </span>
      </label>

      <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Create Listing"}
        {!submitting && <i className="ri-arrow-right-line" />}
      </Button>
    </form>
  );
}
