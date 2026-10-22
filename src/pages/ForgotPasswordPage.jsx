import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Button from "../components/ui/Button";
import { FormField, Input } from "../components/ui/FormField";
import { requestPasswordReset } from "../lib/authClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(err.message || "We couldn't send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a secure reset link."
      footer={<Link to="/auth/login" className="font-semibold text-primary-700 hover:text-primary-800">Back to sign in</Link>}
    >
      {message ? (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-5 text-sm text-primary-900" role="status">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <i className="ri-mail-check-line text-lg" aria-hidden="true" /> Check your email
          </div>
          <p>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700" role="alert">{error}</div>}
          <FormField label="Email" htmlFor="reset-email" required>
            <Input
              id="reset-email"
              type="email"
              icon="ri-mail-line"
              placeholder="you@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </FormField>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? "Sending reset link…" : "Email reset link"}
            {!submitting && <i className="ri-arrow-right-line" aria-hidden="true" />}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
