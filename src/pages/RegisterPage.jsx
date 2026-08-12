import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { register } from "../lib/authClient";

const accountTypes = [
  { value: "customer", label: "Shopper", icon: "ri-user-line", desc: "Browse, buy, and book" },
  { value: "business", label: "Business owner", icon: "ri-store-2-line", desc: "List your business" },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    accountType: "customer",
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
      await register(form);
      navigate(form.accountType === "business" ? "/listings/submit" : "/");
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
        <FormField label="I'm signing up as">
          <div className="grid grid-cols-2 gap-2">
            {accountTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, accountType: t.value }))}
                className={`text-left p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  form.accountType === t.value
                    ? "border-primary-500 bg-primary-50/50"
                    : "border-background-200/70 hover:border-background-400"
                }`}
              >
                <i
                  className={`${t.icon} text-lg mb-1 block ${
                    form.accountType === t.value ? "text-primary-600" : "text-foreground-500"
                  }`}
                />
                <div className="text-sm font-semibold text-foreground-900">{t.label}</div>
                <div className="text-xs text-foreground-500 font-label">{t.desc}</div>
              </button>
            ))}
          </div>
        </FormField>

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
            <a href="#terms" className="text-primary-700 hover:text-primary-800 font-semibold">
              Terms
            </a>{" "}
            and{" "}
            <a href="#privacy" className="text-primary-700 hover:text-primary-800 font-semibold">
              Privacy Policy
            </a>
          </span>
        </label>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting && <i className="ri-arrow-right-line" />}
        </Button>
      </form>
    </AuthLayout>
  );
}
// MARKER_TEST_12345
