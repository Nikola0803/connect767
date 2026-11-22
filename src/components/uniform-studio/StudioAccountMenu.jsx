import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function StudioAccountMenu({ verified = false }) {
  const { isAuthenticated, name, email } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const signedIn = isAuthenticated && verified;
  const redirect = encodeURIComponent(location.pathname + location.search);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !root.current?.contains(event.target))) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  return <div ref={root} className="studio-account-trigger relative shrink-0">
    <button type="button" aria-label="Account and sign in" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} className="flex h-9 min-w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-2 text-sm font-semibold text-white hover:bg-white/10">
      <i className="ri-user-line text-lg" aria-hidden="true" /><span className="hidden xl:inline">{signedIn ? "Account" : "Sign in"}</span>
    </button>
    {open && <div role="menu" aria-label="Studio account" className="absolute right-0 top-[calc(100%+.4rem)] z-[90] w-60 max-w-[calc(100vw-16px)] rounded-xl border border-background-200 bg-white p-2 text-sm text-foreground-950 shadow-2xl">
      <p className="break-words border-b border-background-200 px-3 py-2 text-xs">{signedIn ? `Signed in as ${name || email || "a Connect767 member"}` : "Sign in is required to generate, save or order a design."}</p>
      {signedIn && <Link role="menuitem" to="/dashboard" className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-background-100">My account</Link>}
      <Link role="menuitem" to={`/auth/login?redirect=${redirect}`} className="flex min-h-11 items-center rounded-lg px-3 font-semibold text-primary-800 hover:bg-primary-50">{signedIn ? "Sign in / switch account" : "Sign In"}</Link>
      {!signedIn && <Link role="menuitem" to={`/auth/register?redirect=${redirect}`} className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-background-100">Create Account</Link>}
    </div>}
  </div>;
}
