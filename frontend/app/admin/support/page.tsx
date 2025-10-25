"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";

export type JwtPayload = {
  user_id: number;
  username: string;
  role: string;
  exp: number;
};

type SupportTicket = {
  id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  username: string;
  email: string;
};

export default function AdminSupportPage() {
  const [user, setUser] = useState<{user_id: number; username: string; role: string } | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (decoded.exp * 1000 > Date.now() && decoded.role === "admin") {
        setUser({user_id: decoded.user_id, username: decoded.username, role: decoded.role });
        fetchAllTickets(token);
      } else {
        router.push("/");
      }
    } catch {
      localStorage.removeItem("token");
      router.push("/login");
    }
  }, [router]);

  const fetchAllTickets = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/support/admin/tickets", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      } else {
        setError("Failed to fetch tickets");
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: number, newStatus: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/support/admin/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Refresh tickets
        fetchAllTickets(token);
      } else {
        setError("Failed to update ticket status");
      }
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setError("Network error");
    }
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-10 flex flex-col items-start text-left flex-1 w-full max-w-full">
      <h1 className="text-3xl font-bold w-full mb-6">Support Tickets Management</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p>Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-500">No support tickets yet.</p>
      ) : (
        <div className="w-full space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white p-6 rounded-lg shadow-md border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                  <p className="text-sm text-gray-600">
                    By: {ticket.username} ({ticket.email})
                  </p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(ticket.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                    ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              </div>

              <p className="text-gray-700 mb-4">{ticket.message}</p>

              <div className="flex gap-2">
                {ticket.status !== 'open' && (
                  <Button
                    onClick={() => updateTicketStatus(ticket.id, 'open')}
                    variant="outline"
                    size="sm"
                  >
                    Mark as Open
                  </Button>
                )}
                {ticket.status !== 'resolved' && (
                  <Button
                    onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    Mark as Resolved
                  </Button>
                )}
                {ticket.status !== 'closed' && (
                  <Button
                    onClick={() => updateTicketStatus(ticket.id, 'closed')}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    Mark as Closed
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
