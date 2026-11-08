import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { register } from "../lib/authClient";
import { requireListingOnboarding } from "../lib/listingOnboarding";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    accountType: "business",
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
    <AuthLayout
      eyebrow={
        <>
          <i className="ri-sparkling-2-line" /> Free to join
        </>
      }
      title="Create your account"
      subtitle="Join 12,000+ locals using Connect767 to shop, book, and grow."
      footer={
        <span className="text-foreground-600">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-semibold text-primary-700 hover:text-primary-800">
            Sign in
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
        <FormField label="Full name" htmlFor="name">
          <Input
            id="name"
            icon="ri-user-line"
            placeholder="Jane Baptiste"
            value={form.name}
            onChange={update("name")}
            required
            autoComplete="name"
          />
        </FormField>

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

        <FormField label="Password" htmlFor="password" hint="At least 8 characters">
          <Input
            id="password"
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

        <FormField label="Verify password" htmlFor="confirmPassword" required>
          <Input
            id="confirmPassword"
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
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary-700 hover:text-primary-800 font-semibold">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary-700 hover:text-primary-800 font-semibold">
              Privacy Policy
            </a>
          </span>
        </label>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account & continue"}
          {!submitting && <i className="ri-arrow-right-line" />}
        </Button>
      </form>
    </AuthLayout>
  );
}
// MARKER_TEST_12345
