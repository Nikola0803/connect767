export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="pt-16 md:pt-20 min-h-screen flex items-center justify-center px-4 py-16 bg-background-100/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
              {eyebrow}
            </div>
          )}
          <h1 className="font-heading text-3xl font-light text-foreground-950">{title}</h1>
          {subtitle && (
            <p className="text-sm text-foreground-600 font-label mt-2">{subtitle}</p>
          )}
        </div>

        <div className="bg-background-50 border border-background-200/70 rounded-2xl p-6 md:p-8 shadow-sm">
          {children}
        </div>

        {footer && <div className="text-center mt-6 text-sm font-label">{footer}</div>}
      </div>
    </div>
  );
}
