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
import { ShoppingCart, User, Menu } from "lucide-react";

export type JwtPayload = {
  user_id: number;
  username: string;
  role: string;
  exp: number;
};

export default function NavBar() {
  const [user, setUser] = useState<{user_id: number; username: string; role: string } | null>(
    null
  );
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          if (decoded.exp * 1000 > Date.now())
            setUser({user_id:decoded.user_id, username: decoded.username, role: decoded.role });
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
    <NavigationMenu className="fixed top-0 left-0 bg-orange-500 w-full z-50 shadow-md">
      <div className="flex items-center justify-between h-16 px-6 w-full">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0">
          <Link href="/" className="text-2xl font-bold text-white">
            ShopUUU
          </Link>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="flex">
            <input
              type="search"
              name="search-bar"
              id="search"
              placeholder="Search products..."
              className="flex-1 bg-white rounded-l px-4 py-2 focus:outline-none text-gray-900"
            />
            <button className="bg-orange-700 hover:bg-orange-800 px-4 py-2 rounded-r text-white font-semibold">
              Search
            </button>
          </div>
        </div>

        {/* Right side - Navigation */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <NavigationMenuList className="flex gap-4 items-center list-none p-0 m-0">
            <NavigationMenuItem className="list-none">
              <Link href="/" className="font-medium text-white hover:text-gray-200 transition">
                Home
              </Link>
            </NavigationMenuItem>

            {user ? (
              <>
                {/* Admin Dashboard */}
                {user?.role === "admin" && (
                  <NavigationMenuItem className="list-none">
                    <Link
                      href="/admin"
                      className="font-semibold text-white hover:text-gray-200 transition flex items-center gap-1"
                    >
                      <User size={18} />
                      Dashboard
                    </Link>
                  </NavigationMenuItem>
                )}

                {/* Cart */}
                <NavigationMenuItem className="list-none">
                  <Link href="/cart" className="font-medium text-white hover:text-gray-200 transition flex items-center gap-1">
                    <ShoppingCart size={18} />
                    Cart
                    {cartCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-1">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </NavigationMenuItem>

                {/* User Menu */}
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
          </NavigationMenuList>
        </div>
      </div>
    </NavigationMenu>
  );
}
