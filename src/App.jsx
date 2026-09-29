import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
// Routes that own the entire viewport — the studio is a full-screen tool,
// so the site header/footer/cart chrome would only be distraction there.
const CHROMELESS_ROUTES = ["/uniforms"];
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import CheckoutThankYouPage from "./pages/CheckoutThankYouPage";
import DirectoryPage from "./pages/DirectoryPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import AddListingPage from "./pages/AddListingPage";
import MatchPage from "./pages/MatchPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import UniformStudioPage from "./pages/UniformStudioPage";
import ProductCustomizerPage from "./pages/ProductCustomizerPage";
import AboutPage from "./pages/AboutPage";
import HelpPage from "./pages/HelpPage";
import PrivacyPage from "./pages/PrivacyPage";
import SavedListingsPage from "./pages/SavedListingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import { CartProvider } from "./hooks/useCart";
import { SavedListingsProvider } from "./hooks/useSavedListings";
import CartDrawer from "./components/CartDrawer";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";

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
    return <main className="w-full h-screen overflow-hidden bg-background-50">{children}</main>;
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
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogPostPage />} />
                  <Route path="/uniforms" element={<UniformStudioPage />} />
                  <Route path="/shop/customize" element={<ProductCustomizerPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </RouteBoundary>
          </Chrome>
        </SavedListingsProvider>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
