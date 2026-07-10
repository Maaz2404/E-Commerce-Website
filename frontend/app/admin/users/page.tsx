"use client";

import { useEffect, useState } from "react";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

interface Message {
  message_id: number;
  sender_type: "user" | "admin";
  message: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: number]: number }>(
    {}
  );

  const [openUser, setOpenUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // 🔥 fetch list of users
  const loadUsers = async () => {
    const res = await fetch(`${baseURL}/users/all-users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setUsers(data.users || []);
  };

  // 🔥 fetch unread counts
  const loadUnreadCounts = async () => {
    const res = await fetch(`${baseURL}/support/messages/unread-counts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    const map: any = {};
    (data.counts || []).forEach((row: any) => {
      map[row.user_id] = row.unread;
    });

    setUnreadCounts(map);
  };

  // 🔥 load chat for selected user
  const openChat = async (u: User) => {
    setOpenUser(u);
    setLoadingChat(true);

    const res = await fetch(
      `${baseURL}/support/messages/user/${u.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    setMessages(data.messages || []);
    setLoadingChat(false);

    // refresh unread badges
    loadUnreadCounts();
  };

  // 🔥 send an admin reply
  const sendAdminMsg = async () => {
    if (!newMsg.trim() || !openUser) return;

    await fetch(`${baseURL}/support/reply/${openUser.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: newMsg }),
    });

    setNewMsg("");
    openChat(openUser);
  };

  useEffect(() => {
    if (!token) return;
    loadUsers();
    loadUnreadCounts();
  }, [token]);

  return (
    <div className="w-full flex flex-col md:flex-row gap-6">
      {/* LEFT: USERS LIST */}
      <div className="w-full md:w-80 bg-white shadow-lg rounded-lg p-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">All Users</h2>

        {users.map((u) => (
          <div
            key={u.id}
            className="border p-3 rounded-lg mb-3 hover:bg-gray-50 cursor-pointer relative flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{u.username}</div>
                <div className="text-sm text-gray-600">{u.email}</div>
              </div>
              {unreadCounts[u.id] > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCounts[u.id]}
                </span>
              )}
            </div>

            <button
              onClick={() => openChat(u)}
              className="mt-1 w-full bg-orange-500 text-white py-1.5 rounded-md text-sm hover:bg-orange-600"
            >
              Messages
            </button>
          </div>
        ))}
      </div>

      {/* RIGHT: CHAT PANEL */}
      <div className="flex-1">
        {openUser ? (
          <div className="bg-white shadow-lg rounded-lg p-4 h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h2 className="text-lg font-semibold">Chat with {openUser.username}</h2>
                <div className="text-sm text-gray-500">{openUser.email}</div>
              </div>
              <button onClick={() => setOpenUser(null)} className="text-gray-500 hover:text-black">✕</button>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2">
              {loadingChat ? (
                <div className="text-center text-gray-400">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.message_id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`p-3 rounded-lg max-w-xs ${m.sender_type === "admin" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-900"}`}>
                      <div className="whitespace-pre-wrap">{m.message}</div>
                      <div className={`text-[10px] mt-1 ${m.sender_type === "admin" ? "text-gray-100" : "text-gray-500"}`}>
                        {new Date(m.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* send msg */}
            <div className="border-t pt-3 flex gap-2 items-center">
              <label htmlFor="admin-reply" className="sr-only">Reply</label>
              <input
                id="admin-reply"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 border rounded-md p-2"
              />

              <button
                onClick={sendAdminMsg}
                className="bg-orange-500 text-white px-4 rounded-md hover:bg-orange-600"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 h-[85vh] flex items-center justify-center text-gray-400">
            Select a user to view messages
          </div>
        )}
      </div>
    </div>
   );
 }
