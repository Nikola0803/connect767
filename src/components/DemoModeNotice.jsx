/**
 * Shown wherever a form's "success" is currently simulated locally rather
 * than actually reaching a backend — registration, listing submission,
 * uniform quotes, checkout. Without VITE_WP_BASE_URL set, every one of
 * these resolves successfully client-side with nothing sent anywhere,
 * which reads as "it worked" unless this is explicit.
 */
export default function DemoModeNotice({ className = "" }) {
  return (
    <div
      className={`px-3.5 py-2.5 rounded-lg bg-secondary-100 border border-secondary-200 text-xs text-secondary-900 flex items-start gap-2 ${className}`}
    >
      <i className="ri-flask-line mt-0.5 flex-shrink-0" />
      <span>
        Demo mode — no backend connected (<code className="font-mono">VITE_WP_BASE_URL</code>{" "}
        isn't set), so this simulates success without saving anything.
      </span>
    </div>
  );
}
