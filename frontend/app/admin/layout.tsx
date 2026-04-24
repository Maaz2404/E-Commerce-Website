// app/admin/layout.tsx
"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/admin" },
    { name: "Products", href: "/admin/products" },
    { name: "Orders", href: "/admin/orders" },
    { name: "Users", href: "/admin/users" },
    { name: "Coupons", href: "/admin/coupons" },
  ];

  return (
    <SidebarProvider>
      <div className="top-0 left-0 flex min-h-screen pt-10 mt-10 bg-slate-50 relative">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transform transition-transform duration-200 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="p-4 text-lg font-bold border-b border-slate-800 flex justify-between items-center">
            Admin Panel
            {/* close button on mobile */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-4 py-2 rounded-md hover:bg-slate-800 transition text-slate-200 hover:text-blue-300",
                  pathname === item.href && "bg-blue-900 text-white border-l-4 border-blue-500"
                )}
                onClick={() => setIsOpen(false)} // close menu when clicking a link
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 text-sm text-slate-400">
            © {new Date().getFullYear()}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsOpen(false)}
          ></div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <header className="h-14 bg-gradient-to-r from-slate-900 to-blue-900 border-b border-blue-800 flex items-center justify-between px-6 shadow-md">
            <div className="flex items-center gap-2">
              {/* Hamburger button */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden text-slate-300 text-2xl focus:outline-none hover:text-white"
              >
                ☰
              </button>
              <h1 className="font-semibold text-white">Admin Panel</h1>
            </div>
            <div className="text-sm text-blue-100">Welcome, Admin</div>
          </header>

          <main className="flex-1 flex flex-col min-h-[calc(100vh-3.5rem)] p-6 bg-slate-50">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
