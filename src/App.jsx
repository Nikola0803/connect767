import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
// Routes that own the entire viewport — the studio is a full-screen tool,
// so the site header/footer/cart chrome would only be distraction there.
const CHROMELESS_ROUTES = ["/uniforms", "/shop/customize"];
import Header from "./components/Header";
import Footer from "./components/Footer";
import { CartProvider } from "./hooks/useCart";
import { SavedListingsProvider } from "./hooks/useSavedListings";
import CartDrawer from "./components/CartDrawer";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";

// Keep each route in its own chunk. This prevents the 3D design studios and
// dashboard code from slowing down the homepage on mobile connections.
// When the homepage is the initial route, begin fetching its chunk while the
// shell renders instead of waiting for React Router to reach <Suspense>.
// Other routes do not download homepage code they do not need.
const initialHomePageModule = window.location.pathname === "/" ? import("./pages/HomePage") : null;
const HomePage = lazy(() => initialHomePageModule || import("./pages/HomePage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CheckoutThankYouPage = lazy(() => import("./pages/CheckoutThankYouPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const AddListingPage = lazy(() => import("./pages/AddListingPage"));
const MatchPage = lazy(() => import("./pages/MatchPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const UniformStudioPage = lazy(() => import("./pages/UniformStudioPage"));
const ProductCustomizerPage = lazy(() => import("./pages/ProductCustomizerPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const SavedListingsPage = lazy(() => import("./pages/SavedListingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RouteLoading() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4" role="status">
      <div className="flex items-center gap-3 text-sm font-semibold text-foreground-600">
        <span className="h-5 w-5 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
        Loading…
      </div>
    </div>
  );
}

function RouteBoundary({ children }) {
  // Keyed by pathname so navigating to a different page always gets a
  // fresh boundary — otherwise a caught error would keep showing the
  // error screen even after the user tries to leave the broken page.
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function Chrome({ children }) {
  const { pathname } = useLocation();
  const bare = CHROMELESS_ROUTES.includes(pathname);

  if (bare) {
    return <main className="w-full h-[100dvh] overflow-hidden bg-background-50">{children}</main>;
  }

  return (
    <div className="w-full min-h-screen bg-background-50 overflow-x-hidden">
      <Header />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <SavedListingsProvider>
          <ScrollToTop />
          <Chrome>
            <RouteBoundary>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/shop/:slug" element={<ProductDetailPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/checkout/thank-you" element={<CheckoutThankYouPage />} />
                  <Route path="/listings" element={<DirectoryPage />} />
                  <Route path="/listings/submit" element={<AddListingPage />} />
                  <Route path="/listings/:slug/edit" element={<AddListingPage />} />
                  <Route path="/match" element={<MatchPage />} />
                  <Route path="/listings/:slug" element={<ListingDetailPage />} />
                  <Route path="/saved" element={<SavedListingsPage />} />
                  <Route path="/auth/login" element={<AuthPage />} />
                  <Route path="/auth/register" element={<AuthPage />} />
                  <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogPostPage />} />
                  <Route path="/uniforms" element={<UniformStudioPage />} />
                  <Route path="/shop/customize" element={<ProductCustomizerPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </RouteBoundary>
          </Chrome>
        </SavedListingsProvider>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
