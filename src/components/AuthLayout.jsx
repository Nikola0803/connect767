import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbf8f2] px-4 pb-8 pt-24 sm:px-5 md:pb-10 md:pt-28">
      <div className="w-full max-w-[30rem]">
        <div className="mb-5 text-center sm:mb-6">
          <Link to="/" aria-label="Connect767 home" className="mb-3 inline-flex text-primary-700 transition hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
            <BrandLogo className="justify-center" />
          </Link>
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
              {eyebrow}
            </div>
          )}
          <h1 className="font-label text-3xl font-semibold tracking-[-0.025em] text-foreground-950 sm:text-[2rem]">{title}</h1>
          {subtitle && (
            <p className="mx-auto mt-2 max-w-sm font-label text-sm leading-relaxed text-foreground-600">{subtitle}</p>
          )}
        </div>

        <div className="rounded-2xl border border-background-300/70 bg-white p-5 shadow-[0_2px_8px_rgba(61,48,35,0.05)] sm:p-6">
          {children}
        </div>

        {footer && <div className="text-center mt-6 text-sm font-label">{footer}</div>}
      </div>
    </div>
  );
}
