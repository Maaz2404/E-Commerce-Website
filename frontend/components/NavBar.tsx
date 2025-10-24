"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
  username: string;
  role: string;
  exp: number;
};

export default function NavBar() {
  const [user, setUser] = useState<{ username: string; role: string } | null>(
    null
  );
  const router = useRouter();

  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          if (decoded.exp * 1000 > Date.now())
            setUser({ username: decoded.username, role: decoded.role });
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  };

  return (
    <NavigationMenu className="fixed top-0 left-0 bg-orange-500 p-4 w-screen z-50 shadow-md">
      <div className="relative w-full mx-auto">
        {/* Center */}
        <div className="flex items-center justify-center py-1 relative">
          <NavigationMenuList className="flex gap-5 items-center list-none p-0 m-0 w-screen justify-center">
            {/* ✅ Left-aligned admin dashboard */}
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
                name="search-bar"
                id="search"
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
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-3">
          {user ? (
            <>
              <NavigationMenuItem className="list-none">
                <span className="px-3 py-1 text-white font-semibold">
                  Hi, {user.username}
                </span>
              </NavigationMenuItem>

              <NavigationMenuItem className="list-none">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300"
                >
                  Logout
                </button>
              </NavigationMenuItem>
            </>
          ) : (
            <>
              <NavigationMenuItem className="list-none">
                <Link
                  href="/login"
                  className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300"
                >
                  Login
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem className="list-none">
                <Link
                  href="/register"
                  className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300"
                >
                  Sign Up
                </Link>
              </NavigationMenuItem>
            </>
          )}
        </div>
      </div>
    </NavigationMenu>
  );
}
