import { useState } from "react";

const baseFieldClass =
  "w-full px-4 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export function FormField({ label, htmlFor, hint, error, required, children }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-foreground-800 mb-1.5">
          {label}
          {required && (
            <span className="text-accent-500 ml-0.5" aria-label="required">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-foreground-500 font-label">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-accent-600 font-label">{error}</p>}
    </div>
  );
}

export function Input({ className = "", icon, error, type, ...props }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword ? (visible ? "text" : "password") : type;

  if (icon || isPassword) {
    return (
      <div className="relative">
        {icon && (
          <i
            className={`${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-500 text-sm`}
          />
        )}
        <input
          type={effectiveType}
          className={`${baseFieldClass} ${icon ? "pl-10" : ""} ${
            isPassword ? "pr-10" : ""
          } ${error ? "border-accent-500" : ""} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground-500 hover:text-foreground-800 text-sm cursor-pointer"
          >
            <i className={visible ? "ri-eye-off-line" : "ri-eye-line"} />
          </button>
        )}
      </div>
    );
  }
  return (
    <input
      type={type}
      className={`${baseFieldClass} ${error ? "border-accent-500" : ""} ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", error, ...props }) {
  return (
    <textarea
      className={`${baseFieldClass} resize-none ${error ? "border-accent-500" : ""} ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, error, ...props }) {
  return (
    <select
      className={`${baseFieldClass} cursor-pointer ${error ? "border-accent-500" : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
