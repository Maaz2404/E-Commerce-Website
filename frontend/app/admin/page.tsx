"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode, JwtPayload } from "jwt-decode";

interface MyJwtPayload extends JwtPayload {
  username: string;
  role: string;
  exp: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function AdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ------------ AUTH CHECK ------------
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

  // ------------ FETCH STATS ------------
  const fetchStats = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${BASE_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading)
    return <div className="p-10">Loading dashboard...</div>;

  if (!stats)
    return (
      <div className="p-10 text-red-500">
        Failed to fetch stats.
      </div>
    );

  return (
    <div className="p-8 flex flex-col gap-6 w-full">
      <div className="w-full text-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Quick overview of platform stats</p>
      </div>

      {/* TOP ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <DashboardCard title="Total Users" value={stats.users.total} accent="bg-blue-500" />
        <DashboardCard title="Admins" value={stats.users.admins} accent="bg-purple-500" />
        <DashboardCard title="Total Orders" value={stats.orders.total_orders} accent="bg-green-500" />
        <DashboardCard title="Revenue (All Time)" value={`$${stats.orders.total_revenue}`} accent="bg-orange-500" />
      </div>

      {/* SECOND ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mt-6">
        <DashboardCard title="Pending Orders" value={stats.orders.pending_orders} accent="bg-yellow-400" />
        <DashboardCard title="Completed Orders" value={stats.orders.completed_orders} accent="bg-emerald-500" />
        <DashboardCard title="Products" value={stats.products.total_products} accent="bg-indigo-500" />
        <DashboardCard title="Out of Stock" value={stats.products.out_of_stock} accent="bg-red-500" />
      </div>

      {/* THIRD ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mt-6">
        <DashboardCard title="Active Coupons" value={stats.coupons.active} accent="bg-teal-500" />
        <DashboardCard title="Expired Coupons" value={stats.coupons.expired} accent="bg-zinc-500" />
        <DashboardCard title="Unread Support" value={stats.support.unread_messages} accent="bg-pink-500" />
        <DashboardCard title="Support Tickets" value={stats.support.total_support_messages} accent="bg-slate-500" />
      </div>
    </div>
  );
}

// ----------- DASHBOARD CARD COMPONENT -----------
function DashboardCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: any;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
      <div className={`w-2 h-12 rounded ${accent}`} />
      <div className="flex-1">
        <span className="text-sm text-gray-500">{title}</span>
        <div className="text-2xl font-bold mt-1 text-gray-900">{value}</div>
      </div>
    </div>
  );
}
