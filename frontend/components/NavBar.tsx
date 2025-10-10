"use client";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {jwtDecode} from "jwt-decode";

// Type for JWT payload (adjust fields if your token differs)
type JwtPayload = {
  username: string;
  role: string
  exp: number;
};

export default function NavBar() {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
  const loadUser = () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        if (decoded.exp * 1000 > Date.now()) setUser({ username: decoded.username, role: decoded.role });
        else localStorage.removeItem("token");
      } catch {
        localStorage.removeItem("token");
      }
    } else {
      setUser(null);
    }
  };

  loadUser(); // run initially
  window.addEventListener("authChange", loadUser);

  return () => window.removeEventListener("authChange", loadUser);
}, []);


  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  };

  return (
    <NavigationMenu className="bg-orange-500 p-4 w-full">
      <div className="relative w-full mx-auto">
        {/* Center */}
        <div className="flex items-center justify-center py-1">
          <NavigationMenuList className="flex gap-5 items-center list-none p-0 m-0 w-screen">
            <NavigationMenuItem className="list-none">
              <button className="font-medium text-white">
                <Link href="/">Home</Link>
              </button>
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
              <button className="font-medium text-white">Cart</button>
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
                <button className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300">
                  <Link href="/login">Login</Link>
                </button>
              </NavigationMenuItem>

              <NavigationMenuItem className="list-none">
                <button className="px-3 py-1 text-white rounded font-semibold hover:text-gray-300">
                  <Link href="/register">Sign Up</Link>
                </button>
              </NavigationMenuItem>
            </>
          )}
        </div>
      </div>
    </NavigationMenu>
  );
}
