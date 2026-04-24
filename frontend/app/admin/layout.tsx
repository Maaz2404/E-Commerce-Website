"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
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
  ];

  return (
    <SidebarProvider>
      <div className="relative left-0 top-0 mt-10 flex min-h-screen bg-[linear-gradient(180deg,#081121_0%,#040914_100%)] pt-10">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(7,15,28,0.98),rgba(3,7,14,0.98))] text-slate-100 transition-transform duration-200 ease-in-out md:static",
            isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4 text-lg font-bold">
            Admin Panel
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 transition hover:text-white md:hidden"
            >
              x
            </button>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-xl px-4 py-2 transition hover:bg-blue-500/12 hover:text-blue-100",
                  pathname === item.href && "bg-blue-500/14 text-blue-100"
                )}
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4 text-sm text-slate-400">
            Copyright {new Date().getFullYear()}
          </div>
        </aside>

        {isOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setIsOpen(false)}
          ></div>
        )}

        <div className="flex flex-1 flex-col md:ml-64">
          <header className="flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-2xl text-slate-300 focus:outline-none md:hidden"
              >
                =
              </button>
              <h1 className="font-semibold text-white">Admin</h1>
            </div>
            <div className="text-sm text-slate-300">Welcome, Admin</div>
          </header>

          <main className="flex min-h-[calc(100vh-3.5rem)] flex-1 items-center p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
