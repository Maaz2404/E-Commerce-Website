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
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-600 mt-4">Only admins can see this.</p>
    </div>
  );
}
