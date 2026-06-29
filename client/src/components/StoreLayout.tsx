import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, LayoutDashboard, LogOut, User, Menu, Gem, Gift } from "lucide-react";
import { useCartUI } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import CartDrawer from "./CartDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import SearchBar from "./SearchBar";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/crystals", label: "Crystals", icon: Gem },
  { href: "/gift-cards", label: "Gift Cards", icon: Gift },
];

export default function StoreLayout({ children }: { children: ReactNode }) {
  const { open, itemCount } = useCartUI();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-sm hover:bg-accent sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="font-display text-xl tracking-tight">
              RelClothing
            </Link>
          </div>

          <nav className="hidden items-center gap-8 text-sm uppercase tracking-wide sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={location === link.href ? "text-primary" : "hover:text-primary"}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <SearchBar variant="expandable" />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="hidden h-9 w-9 items-center justify-center rounded-sm hover:bg-accent sm:flex"
                  >
                    <User className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{user.name || "Account"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Admin dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="hidden text-sm uppercase tracking-wide hover:text-primary sm:block"
              >
                Log in
              </Link>
            )}
            <button
              type="button"
              onClick={open}
              aria-label="Open cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-sm hover:bg-accent"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer — carries the links AND the login/account access
         that the desktop nav has, since the storefront otherwise has no way
         to log in once the screen drops below `sm`. */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="flex w-3/4 flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="font-display text-xl tracking-tight">RelClothing</SheetTitle>
          </SheetHeader>

          <div className="px-3 pt-4">
            <SearchBar variant="inline" onNavigate={() => setMobileMenuOpen(false)} />
          </div>

          <nav className="flex flex-col gap-1 px-3 py-4 text-base">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-accent"
                >
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t px-3 py-4">
            {user ? (
              <div className="flex flex-col gap-1 text-base">
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-accent"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    Admin dashboard
                  </Link>
                )}
                <div className="flex items-center gap-3 px-2 py-2.5 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="truncate">{user.name || user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 rounded-sm px-2 py-2.5 text-left text-destructive hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full">
                <Button className="w-full" size="lg">
                  Log in
                </Button>
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="container flex flex-col gap-2 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-base text-foreground">RelClothing</p>
          <p>Considered essentials, made to be worn often.</p>
        </div>
      </footer>

      <CartDrawer />
    </div>
  );
}
