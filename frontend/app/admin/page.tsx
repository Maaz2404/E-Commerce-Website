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
    <div className="flex w-full max-w-full flex-1 flex-col items-start rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(10,19,38,0.94),rgba(4,8,16,0.98))] p-10 text-left shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
      <h1 className="w-full text-3xl font-bold text-white">Admin Dashboard</h1>
      <p className="mt-4 w-full text-slate-300">Only admins can see this.</p>

      <div className="mt-8 grid w-full gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-200">
            Theme
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            Blue / Navy / Black
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-200">
            Focus
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            Storefront Consistency
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-200">
            Surface
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            Dark Admin Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
