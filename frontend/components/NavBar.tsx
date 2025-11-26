"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setDropdownOpen(false);
    router.push("/login");
  };

  return (
    <NavigationMenu className="fixed top-0 left-0 bg-orange-500 p-4 w-screen z-50 shadow-md">
      <div className="relative w-full mx-auto">
        {/* Center */}
        <div className="flex items-center justify-center py-1 relative">
          <NavigationMenuList className="flex gap-5 items-center list-none p-0 m-0 w-screen justify-center">
            {user?.role === "admin" && (
              <NavigationMenuItem className="absolute left-4 list-none">
                <Link
                  href="/admin"
                  className="font-semibold text-white hover:text-gray-200 transition"
                >
                  Dashboard
                </Link>
              </NavigationMenuItem>
            )}

            <NavigationMenuItem className="list-none">
              <Link href="/" className="font-medium text-white hover:text-gray-200">
                Home
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <input
                type="search"
                placeholder="Search..."
                className="bg-white rounded px-3 py-2 w-64 focus:outline-none"
              />
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link href="/cart" className="font-medium text-white hover:text-gray-200">
                Cart
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </div>

        {/* Right side */}
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center"
          ref={dropdownRef}
        >
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="px-3 py-1 text-white font-semibold hover:text-gray-300 flex items-center gap-1"
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
                <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-md w-40 py-2 z-50 text-black">
                  <Link
                    href="/order-history"
                    className="block px-4 py-2 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Order History
                  </Link>

                  

                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
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
                className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300"
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
