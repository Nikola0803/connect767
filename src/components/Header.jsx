import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import BrandLogo from "./BrandLogo";
import { getUnreadMessageCount } from "../data/repository";

const navItems = [
  { label: "Directory", href: "/listings" },
  { label: "Shop", href: "/shop" },
  { label: "Custom Uniforms", href: "/uniforms" },
  { label: "Blog", href: "/blog" },
];

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, email, logout } = useAuth();
  const { count: cartCount, setIsOpen: setCartOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // Fully transparent only at the very top of the homepage (over the hero
  // image) — it used to be transparent on "/" no matter how far you'd
  // scrolled, since this was purely path-based with no scroll tracking at
  // all, so the fixed header stayed see-through the whole way down the
  // page with nothing behind the nav links once the hero scrolled away.
  const [scrolled, setScrolled] = useState(false);
  const transparent = pathname === "/" && !mobileOpen && !scrolled;

  useEffect(() => {
    if (pathname !== "/") {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMessages(0);
      return undefined;
    }
    let cancelled = false;
    const refresh = () => getUnreadMessageCount()
      .then((result) => { if (!cancelled) setUnreadMessages(Number(result?.count) || 0); })
      .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, pathname]);

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Once scrolled past the hero on the homepage, use a light greenish
  // tint (the brand's primary color at low opacity) rather than the
  // solid off-white every other page's header uses — keeps some of the
  // "floating over the page" feel instead of hard-cutting to opaque.
  const wrapClass = transparent
    ? "bg-transparent"
    : pathname === "/"
    ? "bg-primary-500/10 backdrop-blur-md border-b border-primary-900/10"
    : "bg-background-50/95 backdrop-blur border-b border-background-200/70";

  const wordmarkText = transparent
    ? "text-background-50 [text-shadow:0_2px_5px_rgba(0,0,0,0.5)]"
    : "text-primary-950";
  const logoMarkFilter = transparent
    ? "drop-shadow(1px 0 0 rgba(255,255,255,0.72)) drop-shadow(-1px 0 0 rgba(255,255,255,0.72)) drop-shadow(0 1px 3px rgba(0,0,0,0.48))"
    : "drop-shadow(0 1px 1px rgba(255,255,255,0.55))";
  const iconBtnText = transparent ? "text-background-50" : "text-foreground-950";
  const navBase = transparent
    ? "text-background-50/85 hover:text-background-50 hover:bg-background-50/10"
    : "text-foreground-700 hover:text-foreground-950 hover:bg-background-100";
  const navActive = transparent
    ? "text-background-50 bg-background-50/15"
    : "text-primary-700 bg-primary-50";
  const addListingClass = transparent
    ? "border-background-50/40 text-background-50 hover:bg-background-50/10"
    : "border-background-300 text-foreground-800 hover:bg-background-100";
  const signInClass = transparent
    ? "text-background-50/85 hover:text-background-50"
    : "text-foreground-700 hover:text-foreground-950";

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${wrapClass}`}
    >
      <div className="w-full px-3 sm:px-4 md:px-8 lg:px-12 flex items-center h-16 md:h-20 pt-[env(safe-area-inset-top)]">
        <Link
          aria-label="Connect767 home"
          className={`group flex min-w-0 cursor-pointer ${wordmarkText}`}
          to="/"
        >
          <BrandLogo compactOnNarrow markFilter={logoMarkFilter} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-10">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  isActive ? navActive : navBase
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:gap-3">
          <Link
            to="/saved"
            aria-label="Saved listings"
            className="hidden sm:flex w-10 h-10 items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
          >
            <i className={`ri-heart-line text-lg ${iconBtnText}`} />
          </Link>
          {isAuthenticated && (
            <Link
              to="/messages"
              aria-label="Messages"
              className="relative hidden sm:flex w-10 h-10 items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
            >
              <i className={`ri-chat-3-line text-lg ${iconBtnText}`} />
              {unreadMessages > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-background-50">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            aria-label="Open cart"
            onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
          >
            <i className={`ri-shopping-cart-2-line text-lg ${iconBtnText}`} />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[9px] font-bold">
                {cartCount}
              </span>
            )}
          </button>

          {isAuthenticated && (
            <Link
              className={`hidden lg:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${addListingClass}`}
              to="/listings/submit"
            >
              <i className="ri-add-line" />
              Add Listing
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative hidden md:block group">
              <button
                type="button"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md cursor-pointer whitespace-nowrap ${signInClass}`}
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-xs font-bold">
                  {(email || "?")[0]?.toUpperCase()}
                </div>
                <span className="hidden md:inline">{email}</span>
                <i className="ri-arrow-down-s-line" />
              </button>
              <div className="absolute right-0 top-full pt-2 hidden group-hover:block">
                <div className="w-48 rounded-lg border border-background-200/70 bg-background-50 shadow-lg py-1.5">
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-dashboard-line" />
                    Dashboard
                  </Link>
                  <Link
                    to="/messages"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-chat-3-line" />
                    Messages
                  </Link>
                  <Link
                    to="/listings/submit"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-add-line" />
                    Add a listing
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className="ri-logout-box-line" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1 lg:gap-2">
              <Link
                className={`hidden lg:inline-flex px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${signInClass}`}
                to="/auth/login"
              >
                Sign in
              </Link>
              <Link
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-primary-500 text-background-50 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                to="/auth/register"
              >
                Register
              </Link>
            </div>
          )}

          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className={`md:hidden w-10 h-10 flex items-center justify-center rounded-md cursor-pointer ${iconBtnText} hover:bg-background-50/10`}
          >
            <i className={`text-xl ${mobileOpen ? "ri-close-line" : "ri-menu-line"}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-background-200/70 bg-background-50 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
          <nav className="flex flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "text-primary-700 bg-primary-50"
                      : "text-foreground-800 hover:bg-background-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <Link
              to="/saved"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer"
            >
              <i className="ri-heart-line" />
              Saved
            </Link>

            <div className="my-2 border-t border-background-200/70" />

            {isAuthenticated && (
              <Link
                to="/listings/submit"
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-add-line" />
                Add Listing
              </Link>
            )}

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-xs font-bold">
                    {(email || "?")[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-foreground-700 truncate">{email}</span>
                </div>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-dashboard-line" />
                  Dashboard
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-chat-3-line" />
                  Messages
                </Link>
                <Link
                  to="/listings/submit"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-add-line" />
                  Add a listing
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md text-foreground-800 hover:bg-background-100 cursor-pointer text-left"
                >
                  <i className="ri-logout-box-line" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-2 grid gap-2">
                <Link
                  to="/auth/register"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-md bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer"
                >
                  Register
                </Link>
                <Link
                  to="/auth/login"
                  className="inline-flex items-center justify-center px-4 py-3 text-sm font-semibold rounded-md border border-background-300 text-foreground-800 hover:bg-background-100 cursor-pointer"
                >
                  Sign in
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
