"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode, JwtPayload } from "jwt-decode";


interface MyJwtPayload extends JwtPayload {
  username: string;
  role: string;
  exp: number;
}

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    try {
      const decoded = jwtDecode<MyJwtPayload>(token);
      if (decoded.role !== "admin") router.push("/");
    } catch {
      router.push("/login");
    }
  }, []);

  return (
    // This container should take the remaining space to the right of the sidebar
    // It must be full width of the main content area, left-aligned, and allow children to stretch.
    <div className="p-10 flex flex-col items-start text-left flex-1 w-full max-w-full">
      <h1 className="text-3xl font-bold w-full">Admin Dashboard</h1>
      <p className="text-gray-600 mt-4 w-full">Only admins can see this.</p>
    </div>
  );
}
