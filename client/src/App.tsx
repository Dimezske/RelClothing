import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import StoreLayout from "./components/StoreLayout";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { trpc } from "@/lib/trpc";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Crystals from "./pages/Crystals";
import GiftCards from "./pages/GiftCards";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminTraffic from "./pages/admin/Traffic";
import AdminOrders from "./pages/admin/Orders";
import AdminProducts from "./pages/admin/Products";
import AdminUsers from "./pages/admin/Users";
import AdminGiftCards from "./pages/admin/GiftCards";

function PageViewTracker() {
  const [location] = useLocation();
  const track = trpc.analytics.track.useMutation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === location) return;
    lastTracked.current = location;
    track.mutate({ path: location, referrer: document.referrer || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return null;
}

function StorefrontRoutes() {
  return (
    <StoreLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/shop"} component={Shop} />
        <Route path={"/crystals"} component={Crystals} />
        <Route path={"/gift-cards"} component={GiftCards} />
        <Route path={"/product/:slug"} component={ProductDetail} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/order/:id"} component={OrderConfirmation} />
        <Route path={"/login"} component={Login} />
        <Route path={"/signup"} component={Signup} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </StoreLayout>
  );
}

function AdminRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/admin"} component={AdminTraffic} />
        <Route path={"/admin/orders"} component={AdminOrders} />
        <Route path={"/admin/products"} component={AdminProducts} />
        <Route path={"/admin/gift-cards"} component={AdminGiftCards} />
        <Route path={"/admin/users"} component={AdminUsers} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
     return (
       <Switch>
         <Route path={"/admin"} component={AdminRoutes} />
         <Route path={"/admin/:rest*"} component={AdminRoutes} />
         <Route component={StorefrontRoutes} />
       </Switch>
     );
   }

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <CartProvider>
            <PageViewTracker />
            <Router />
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
