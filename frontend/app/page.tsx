"use client";

import ProductCard, { ProductInput } from "@/components/ProductCard";
import { useEffect, useRef, useState } from "react";
import { useCouponStore, Coupon } from "@/store/couponStore";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

type SupportMessage = {
  id: number;
  sender_type: "user" | "admin";
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function HomePage() {
  const [products, setProducts] = useState<ProductInput[]>([]);
  const { activeCoupons, setActiveCoupons } = useCouponStore();

  const [showCoupons, setShowCoupons] = useState(true);

  // ---- Support chat widget state ----
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);

  // load products + coupons once
  useEffect(() => {
    fetch(`${baseURL}/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data?.products ?? []))
      .catch((err) => console.error("Products fetch error:", err));

    fetch(`${baseURL}/coupons/active`)
      .then((res) => res.json())
      .then((data) => setActiveCoupons(data?.active_coupons ?? []))
      .catch((err) => console.error("Coupons fetch error:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: get token from localStorage
  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  };

  // fetch chat messages when widget opens
  const openChat = async () => {
    setChatError(null);
    const token = getToken();
    if (!token) {
      // show panel but prompt login in UI
      setChatOpen(true);
      setChatMessages([]);
      return;
    }

    setChatOpen(true);
    await loadMessages(token);
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatError(null);
  };

  // load messages from backend (GET /support/messages)
  const loadMessages = async (token?: string | null) => {
    const t = token ?? getToken();
    if (!t) {
      setChatMessages([]);
      return;
    }

    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch(`${baseURL}/support/messages`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `Failed to fetch messages (${res.status})`);
      }

      const json = await res.json();
      // assume backend returns { messages: [...] } in chronological ASC order
      const msgs: SupportMessage[] = (json?.messages ?? []).map((m: any) => ({
        id: m.id,
        sender_type: m.sender_type,
        message: m.message,
        is_read: !!m.is_read,
        created_at: m.created_at,
      }));

      setChatMessages(msgs);
      // scroll down after DOM update
      setTimeout(() => scrollToBottom(), 50);
    } catch (err: any) {
      console.error("loadMessages error:", err);
      setChatError(err?.message ?? "Failed to load messages");
    } finally {
      setChatLoading(false);
    }
  };

  // send message (POST /support/send)
  const sendMessage = async () => {
    if (messageInput.trim() === "") return;
    const token = getToken();
    if (!token) {
      setChatError("You must be logged in to send messages.");
      return;
    }

    // optimistic UI: append message locally with a temporary id (negative)
    const tempId = Date.now() * -1;
    const newMsg: SupportMessage = {
      id: tempId,
      sender_type: "user",
      message: messageInput,
      is_read: true,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setMessageInput("");
    setSending(true);
    setChatError(null);
    setTimeout(() => scrollToBottom(), 10);

    try {
      const res = await fetch(`${baseURL}/support/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMsg.message }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Send failed (${res.status})`);
      }

      // replace temporary message with server message (server returns inserted row in "data")
      const returned = json?.data;
      if (returned) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: returned.id,
                  sender_type: returned.sender_type,
                  message: returned.message,
                  is_read: !!returned.is_read,
                  created_at: returned.created_at,
                }
              : m
          )
        );
      } else {
        // If server didn't return inserted row, just keep optimistic message but mark as sent (no-op)
      }
    } catch (err: any) {
      console.error("sendMessage error:", err);
      // rollback optimistic message: mark as failed visually or remove
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      setChatError(err?.message ?? "Failed to send message");
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  // scroll messages to bottom
  const scrollToBottom = () => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  // keyboard send (Enter)
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="pt-20 m-5 flex">
      {/* Products Grid */}
      <div className="flex-1 grid items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {products.map((product: ProductInput) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>

      {/* Floating Coupons Panel */}
      {showCoupons && activeCoupons.length > 0 && (
        <div className="fixed right-5 top-20 w-64 bg-white shadow-lg rounded-lg p-4 z-40">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-lg">Active Coupons</h2>
            <button
              className="text-gray-500 hover:text-gray-800"
              onClick={() => setShowCoupons(false)}
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {activeCoupons.map((c: Coupon) => (
              <div
                key={c.id}
                className="bg-orange-100 p-2 rounded-md hover:bg-orange-200 cursor-pointer"
                onClick={() => navigator.clipboard.writeText(c.code)}
              >
                <p className="font-semibold">{c.code}</p>
                <p className="text-sm text-gray-700">
                  {c.discount_type === "percent"
                    ? `${c.discount_value}% off`
                    : `$${c.discount_value} off`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Support Chat Widget ===== */}
      <div className="fixed right-5 bottom-5 z-50">
        {/* collapsed button */}
        {!chatOpen && (
          <button
            onClick={() => openChat()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-full shadow-lg focus:outline-none"
            title="Support"
          >
            <span className="text-xl">💬</span>
            <span className="font-medium">Support</span>
          </button>
        )}

        {/* expanded chat panel */}
        {chatOpen && (
          <div className="w-80 md:w-96 h-96 bg-white shadow-2xl rounded-lg overflow-hidden flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 bg-orange-500 text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">?</div>
                <div>
                  <div className="font-semibold">Support</div>
                  <div className="text-xs opacity-90">We're here to help</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // reload messages if logged in
                    const token = getToken();
                    if (token) loadMessages(token);
                  }}
                  className="text-sm px-2 py-1 bg-white/20 rounded"
                  title="Refresh"
                >
                  Refresh
                </button>
                <button onClick={closeChat} className="text-xl font-bold px-2">
                  ✕
                </button>
              </div>
            </div>

            {/* body: messages */}
            <div
              ref={messagesRef}
              className="flex-1 overflow-auto px-3 py-3 space-y-3 bg-gray-50"
            >
              {chatLoading && (
                <div className="text-center text-sm text-gray-500">Loading messages...</div>
              )}

              {!chatLoading && !getToken() && (
                <div className="text-center text-sm text-gray-600">
                  You must be logged in to view and send messages.
                </div>
              )}

              {!chatLoading && getToken() && chatMessages.length === 0 && (
                <div className="text-center text-sm text-gray-600">
                  No messages yet. Send the first message — our team will reply soon.
                </div>
              )}

              {/* messages list */}
              {!chatLoading && getToken() && chatMessages.length > 0 && (
                <div className="space-y-2">
                  {chatMessages.map((m) => {
                    const isUser = m.sender_type === "user";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-lg break-words text-sm ${
                            isUser ? "bg-orange-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{m.message}</div>
                          <div className={`text-xs mt-1 ${isUser ? "text-white/80" : "text-gray-500"}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* error */}
              {chatError && <div className="text-sm text-red-500 text-center">{chatError}</div>}
            </div>

            {/* footer: input */}
            <div className="px-3 py-3 border-t bg-white">
              {!getToken() ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-gray-700">Log in to chat with support.</div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Write a message... (Enter to send)"
                    className="flex-1 resize-none h-12 p-2 border rounded"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || messageInput.trim() === ""}
                    className={`px-4 rounded ${sending ? "bg-gray-400 text-white" : "bg-orange-500 text-white hover:bg-orange-600"}`}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
