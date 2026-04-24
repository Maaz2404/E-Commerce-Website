"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const router = useRouter();

  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          if (decoded.exp * 1000 > Date.now()) {
            setUser({
              user_id: decoded.user_id,
              username: decoded.username,
              role: decoded.role,
            });
          } else {
            localStorage.removeItem("token");
          }
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
    <NavigationMenu className="fixed top-0 left-0 z-50 w-screen border-b border-white/10 bg-[linear-gradient(90deg,rgba(2,6,23,0.96),rgba(11,23,52,0.96),rgba(30,64,175,0.72))] px-4 py-4 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-md">
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="relative flex items-center justify-center py-1">
          <NavigationMenuList className="flex w-screen list-none items-center justify-center gap-5 p-0 m-0">
            {user?.role === "admin" && (
              <NavigationMenuItem className="absolute left-4 list-none">
                <Link
                  href="/admin"
                  className="rounded-full border border-white/15 bg-white/8 px-4 py-2 font-semibold text-slate-100 transition hover:border-blue-300/40 hover:bg-blue-400/10 hover:text-blue-100"
                >
                  Dashboard
                </Link>
              </NavigationMenuItem>
            )}

            <NavigationMenuItem className="list-none">
              <Link
                href="/"
                className="font-medium text-slate-100 transition hover:text-blue-200"
              >
                Home
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <input
                type="search"
                name="search-bar"
                id="search"
                placeholder="Search..."
                className="w-64 rounded-full border border-white/15 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                href="/cart"
                className="font-medium text-slate-100 transition hover:text-blue-200"
              >
                Cart
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </div>

        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-3">
          {user ? (
            <>
              <NavigationMenuItem className="list-none">
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm font-semibold text-slate-100">
                  Hi, {user.username}
                </span>
              </NavigationMenuItem>

              <NavigationMenuItem className="list-none">
                <button
                  onClick={handleLogout}
                  className="rounded-full px-3 py-1 font-semibold text-slate-100 transition hover:text-blue-200"
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
                  className="rounded-full px-3 py-1 font-semibold text-slate-100 transition hover:text-blue-200"
                >
                  Login
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem className="list-none">
                <Link
                  href="/register"
                  className="rounded-full border border-blue-300/30 bg-blue-400/12 px-3 py-1 font-semibold text-blue-100 transition hover:border-blue-200/45 hover:bg-blue-400/20"
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
