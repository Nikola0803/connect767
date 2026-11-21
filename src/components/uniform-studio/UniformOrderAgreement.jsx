export const UNIFORM_ORDER_TERMS_VERSION = "2026-11-21";

export default function UniformOrderAgreement({ accepted, onChange }) {
  return <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
    <p id="uniform-order-policy" className="text-xs font-semibold">Custom uniforms are made to order and are non-refundable.</p>
    <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-2 text-xs leading-relaxed">
      <input type="checkbox" required checked={accepted} onChange={(event) => onChange(event.target.checked)} aria-describedby={accepted ? "uniform-order-policy" : "uniform-order-policy uniform-order-consent-help"} className="mt-0.5 h-5 w-5 shrink-0 accent-[#00784b]" />
      <span>I agree to the <a href="/terms#custom-uniforms" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Terms &amp; Conditions</a> and understand that custom uniform orders are non-refundable.</span>
    </label>
    {!accepted && <p id="uniform-order-consent-help" className="mt-1 text-[11px] font-medium">Required before placing or paying for your order.</p>}
  </div>;
}
