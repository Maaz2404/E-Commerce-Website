"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import ThemeToggle from "@/components/ThemeToggle";

export type JwtPayload = {
  user_id: number;
  username: string;
  role: string;
  exp: number;
};

export default function NavBar() {
  const [user, setUser] = useState<{
    user_id: number;
    username: string;
    role: string;
  } | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          if (decoded.exp * 1000 > Date.now())
            setUser({
              user_id: decoded.user_id,
              username: decoded.username,
              role: decoded.role,
            });
          else localStorage.removeItem("token");
        } catch {
          localStorage.removeItem("token");
        }
      } else {
        setUser(null);
      }
    };

    loadUser();
    window.addEventListener("authChange", loadUser);
    return () => window.removeEventListener("authChange", loadUser);
  }, []);

  // close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get("search") ?? "");
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setDropdownOpen(false);
    router.push("/login");
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/?search=${encodeURIComponent(trimmed)}` : "/");
  };

  return (
    <NavigationMenu className="fixed top-0 left-0 z-50 w-screen border-b border-sky-900/20 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 p-4 shadow-lg">
      <div className="relative w-full mx-auto">
        {/* Center */}
        <div className="flex items-center justify-center py-1 relative">
          <NavigationMenuList className="flex w-screen items-center justify-center gap-5 p-0 m-0 list-none">
            {user?.role === "admin" && (
              <NavigationMenuItem className="absolute left-4 list-none">
                <Link
                  href="/admin"
                  className="rounded-full px-3 py-2 font-semibold text-white transition duration-200 hover:bg-white/10 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Dashboard
                </Link>
              </NavigationMenuItem>
            )}

            <NavigationMenuItem className="list-none">
              <Link
                href="/"
                className="rounded-full px-3 py-2 font-medium text-white transition duration-200 hover:bg-white/10 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Home
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="w-64 rounded-full border border-white/15 bg-white px-4 py-2 text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Search
                </button>
              </form>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                href="/cart"
                className="rounded-full px-3 py-2 font-medium text-white transition duration-200 hover:bg-white/10 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Cart
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </div>

        {/* Right side */}
        <div
          className="absolute right-4 top-1/2 flex items-center gap-3 -translate-y-1/2"
          ref={dropdownRef}
        >
          <ThemeToggle />

          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-white transition duration-200 hover:bg-white/10 hover:text-amber-200"
              >
                Hi, {user.username}
                <svg
                  className={`w-4 h-4 transition ${dropdownOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white py-2 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
                  <Link
                    href="/order-history"
                    className="block px-4 py-2 transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Order History
                  </Link>

                  <button
                    className="w-full px-4 py-2 text-left transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white transition duration-200 hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition duration-200 hover:bg-amber-300"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </NavigationMenu>
  );
}
