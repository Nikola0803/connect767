export default function MobileStudioNavigation({ panel, onPanelChange, onPreview, onOrder }) {
  return <nav className="studio-mobile-nav" aria-label="Studio mobile tools">
    {[
      ["setup", "Design", "ri-shirt-line", () => onPanelChange(panel === "setup" ? "" : "setup")],
      ["ai", "AI", "ri-sparkling-2-line", () => onPanelChange(panel === "ai" ? "" : "ai")],
      ["", "Preview", "ri-eye-line", onPreview],
      ["order", "Order", "ri-shopping-bag-3-line", onOrder],
    ].map(([key, label, icon, action]) => <button key={label} type="button" onClick={action} aria-label={`Studio ${label.toLowerCase()}`} aria-pressed={panel === key}>
      <i className={icon} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </nav>;
}
