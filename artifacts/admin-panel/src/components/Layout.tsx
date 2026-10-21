import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Receipt,
  LogOut,
  Menu,
  Download,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/loans", label: "Préstamos", icon: Smartphone },
  { href: "/payments", label: "Pagos", icon: Receipt },
  { href: "/apk", label: "Distribuir APK", icon: Download },
];

function NavLinks({ currentPath }: { currentPath: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="px-3 py-4 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Smartphone className="w-5 h-5" />
          </span>
          FinJoy
        </h1>
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive =
          currentPath === item.href ||
          (item.href !== "/" && currentPath.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon
              className={`w-5 h-5 ${isActive ? "text-primary-foreground/90" : ""}`}
            />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card fixed h-screen top-0 left-0 z-10">
        <NavLinks currentPath={location} />
        <div className="mt-auto p-4 border-t border-border">
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 font-medium">
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card flex items-center px-4 z-20">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <NavLinks currentPath={location} />
          </SheetContent>
        </Sheet>
        <span className="ml-4 font-bold text-lg text-primary flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          FinJoy
        </span>
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full md:pl-64 pt-16 md:pt-0 min-h-screen">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
