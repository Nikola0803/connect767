import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import DemoModeNotice from "../components/DemoModeNotice";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { login, register } from "../lib/authClient";
import { isLiveApi } from "../lib/config";
import { getMyListings } from "../data/repository";
import {
  listingOnboardingRequired,
  requireListingOnboarding,
} from "../lib/listingOnboarding";

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
        tab === "login" ? "Welcome back" : "Create account"
      }
      subtitle={
        tab === "login"
          ? "Manage your listings, orders, and uniform designs."
          : "Join Connect767 and reach more customers."
      }
    >
      <div className="mb-5 inline-flex w-full items-center gap-1 rounded-xl bg-background-100 p-1">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 cursor-pointer rounded-lg py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
            tab === "login"
              ? "bg-primary-600 text-white"
              : "text-foreground-500 hover:text-foreground-800"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 cursor-pointer rounded-lg py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
            tab === "register"
              ? "bg-primary-600 text-white"
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
      let needsFirstListing = listingOnboardingRequired();
      if (!needsFirstListing && isLiveApi) {
        try {
          const listings = await getMyListings();
          needsFirstListing = listings.length === 0;
        } catch {
          // A temporary listings request failure should not block an existing
          // owner from signing in. The dashboard can retry its own data load.
        }
      }
      if (needsFirstListing) {
        requireListingOnboarding();
        navigate("/listings/submit?onboarding=1&tier=free", { replace: true });
      } else {
        navigate(location.state?.from || "/");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
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
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
        />
      </FormField>

      <div className="flex items-center justify-between gap-4 font-label text-xs">
        <label className="flex items-center gap-2 text-foreground-600 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded border-background-300 accent-primary-600" />
          Remember me
        </label>
        <Link to="/auth/forgot-password" className="text-primary-700 hover:text-primary-800 font-semibold">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="primary" className="h-12 w-full rounded-xl" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center font-label text-xs text-foreground-500">
        New to Connect767?{" "}
        <Link to="/auth/register" className="font-semibold text-primary-700 hover:text-primary-800">Create an account</Link>
      </p>
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
  const [passwordFocused, setPasswordFocused] = useState(false);

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
      requireListingOnboarding();
      navigate("/listings/submit?onboarding=1&tier=free", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5" />
          {error}
        </div>
      )}

      <FormField label="Account Name" htmlFor="name">
        <Input
          id="name"
          icon="ri-user-line"
          placeholder="Personal or Business Name"
          value={form.name}
          onChange={update("name")}
          required
          autoComplete="name"
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
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
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
        />
      </FormField>

      <FormField label="Password" htmlFor="reg-password" hint={passwordFocused || form.password ? "At least 8 characters" : ""}>
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
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
        />
      </FormField>

      <FormField label="Confirm password" htmlFor="reg-confirm-password">
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
          className="h-12 rounded-xl bg-white focus:ring-2 focus:ring-primary-100"
        />
      </FormField>

      <label className="flex cursor-pointer items-start gap-2.5 font-label text-xs leading-relaxed text-foreground-600">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-background-300 accent-primary-600"
          checked={form.agree}
          onChange={update("agree")}
        />
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="text-primary-700 hover:text-primary-800 font-semibold">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary-700 hover:text-primary-800 font-semibold">
            Privacy Policy
          </a>
        </span>
      </label>

      <Button type="submit" variant="primary" className="h-12 w-full rounded-xl" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center font-label text-xs text-foreground-500">
        Already have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-primary-700 hover:text-primary-800">Sign in</Link>
      </p>
    </form>
  );
}
