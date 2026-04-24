"use client";

import ProductCard, { ProductInput } from "@/components/ProductCard";
import { useCouponStore, Coupon } from "@/store/couponStore";
import { formatCurrency } from "@/lib/format";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const searchParams = useSearchParams();

  const [showCoupons, setShowCoupons] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const categories = ["All", "Bakery", "Beverages", "Snacks", "Dairy"];
  const searchQuery = (searchParams.get("search") ?? "").trim().toLowerCase();

  useEffect(() => {
    fetch(`${baseURL}/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data?.products ?? []))
      .catch((err) => console.error("Products fetch error:", err));

    fetch(`${baseURL}/coupons/active`)
      .then((res) => res.json())
      .then((data) => setActiveCoupons(data?.active_coupons ?? []))
      .catch((err) => console.error("Coupons fetch error:", err));
  }, [setActiveCoupons]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;

    const searchableContent = [
      product.name,
      product.description,
      product.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchQuery || searchableContent.includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  };

  const scrollToBottom = () => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  const loadMessages = async (token?: string | null) => {
    const authToken = token ?? getToken();
    if (!authToken) {
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
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `Failed to fetch messages (${res.status})`);
      }

      const json = await res.json();
      const messages: SupportMessage[] = (json?.messages ?? []).map((message: any) => ({
        id: message.id,
        sender_type: message.sender_type,
        message: message.message,
        is_read: !!message.is_read,
        created_at: message.created_at,
      }));

      setChatMessages(messages);
      setTimeout(() => scrollToBottom(), 50);
    } catch (error: any) {
      console.error("loadMessages error:", error);
      setChatError(error?.message ?? "Failed to load messages");
    } finally {
      setChatLoading(false);
    }
  };

  const openChat = async () => {
    setChatError(null);
    const token = getToken();

    setChatOpen(true);
    if (!token) {
      setChatMessages([]);
      return;
    }

    await loadMessages(token);
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatError(null);
  };

  const sendMessage = async () => {
    if (messageInput.trim() === "") return;

    const token = getToken();
    if (!token) {
      setChatError("You must be logged in to send messages.");
      return;
    }

    const tempId = Date.now() * -1;
    const optimisticMessage: SupportMessage = {
      id: tempId,
      sender_type: "user",
      message: messageInput,
      is_read: true,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMessage]);
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
        body: JSON.stringify({ message: optimisticMessage.message }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Send failed (${res.status})`);
      }

      const returned = json?.data;
      if (returned) {
        setChatMessages((prev) =>
          prev.map((message) =>
            message.id === tempId
              ? {
                  id: returned.id,
                  sender_type: returned.sender_type,
                  message: returned.message,
                  is_read: !!returned.is_read,
                  created_at: returned.created_at,
                }
              : message
          )
        );
      }
    } catch (error: any) {
      console.error("sendMessage error:", error);
      setChatMessages((prev) => prev.filter((message) => message.id !== tempId));
      setChatError(error?.message ?? "Failed to send message");
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="px-4 pb-10 pt-6 md:px-6">
      <div className="mx-auto flex max-w-7xl gap-6">
        <div className="flex-1">
          <section className="mb-6 rounded-[2rem] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-amber-50 px-6 py-8 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                  Easy Shopping
                </p>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
                  Find essentials faster, with less guesswork.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                  Browse by category, search by name, and get help quickly if you need it.
                  For direct support, call{" "}
                  <span className="font-semibold text-slate-950 dark:text-white">03122417654</span>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Search status
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                    {searchQuery ? `Results for "${searchQuery}"` : "Showing all products"}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Need help?
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                    Call 03122417654
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6 flex flex-col gap-3 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Filter products</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Choose a category to reduce clutter and find items faster.
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="rounded-full border border-sky-200 bg-slate-50 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"} found
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">No products match this filter yet.</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Try a different search or switch back to <span className="font-semibold">All</span> categories.
              </p>
            </div>
          ) : (
            <div className="grid items-stretch grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          )}
        </div>

        {showCoupons && activeCoupons.length > 0 && (
          <div className="fixed right-5 top-24 z-40 hidden w-72 rounded-3xl border border-sky-100 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 xl:block">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Coupons</h2>
              <button
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setShowCoupons(false)}
                aria-label="Hide active coupons"
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Tap any coupon to copy it before checkout.
            </p>
            <div className="space-y-2">
              {activeCoupons.map((coupon: Coupon) => (
                <div
                  key={coupon.id}
                  className="cursor-pointer rounded-2xl border border-sky-100 bg-sky-50 p-3 transition hover:border-amber-200 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
                  onClick={() => navigator.clipboard.writeText(coupon.code)}
                >
                  <p className="font-semibold text-sky-700 dark:text-sky-300">{coupon.code}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}% off`
                      : `${formatCurrency(coupon.discount_value)} off`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-5 right-5 z-50">
        {!chatOpen && (
          <button
            onClick={openChat}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-slate-950 to-sky-800 px-4 py-3 text-white shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            title="Support"
          >
            <span className="text-xl">💬</span>
            <span className="font-medium">Need help?</span>
          </button>
        )}

        {chatOpen && (
          <div className="flex h-96 w-80 flex-col overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:w-96">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 to-sky-800 px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-semibold">
                  ?
                </div>
                <div>
                  <div className="font-semibold">Support</div>
                  <div className="text-xs opacity-90">Call 03122417654 or chat here</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const token = getToken();
                    if (token) loadMessages(token);
                  }}
                  className="rounded px-2 py-1 text-sm bg-white/20"
                  title="Refresh"
                >
                  Refresh
                </button>
                <button onClick={closeChat} className="px-2 text-xl font-bold" aria-label="Close support chat">
                  ×
                </button>
              </div>
            </div>

            <div
              ref={messagesRef}
              className="flex-1 space-y-3 overflow-auto bg-gradient-to-br from-sky-50 to-slate-50 px-3 py-3 dark:from-slate-950 dark:to-slate-900"
            >
              {chatLoading && (
                <div className="text-center text-sm text-gray-500 dark:text-slate-400">Loading messages...</div>
              )}

              {!chatLoading && !getToken() && (
                <div className="text-center text-sm text-gray-600 dark:text-slate-300">
                  You must be logged in to view and send messages.
                </div>
              )}

              {!chatLoading && getToken() && chatMessages.length === 0 && (
                <div className="text-center text-sm text-gray-600 dark:text-slate-300">
                  No messages yet. Send the first message and our team will reply soon.
                </div>
              )}

              {!chatLoading && getToken() && chatMessages.length > 0 && (
                <div className="space-y-2">
                  {chatMessages.map((message) => {
                    const isUser = message.sender_type === "user";

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] break-words rounded-lg px-3 py-2 text-sm ${
                            isUser
                              ? "rounded-br-none bg-gradient-to-r from-slate-950 to-sky-800 text-white"
                              : "rounded-bl-none border border-sky-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.message}</div>
                          <div className={`mt-1 text-xs ${isUser ? "text-white/70" : "text-slate-500"}`}>
                            {new Date(message.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {chatError && <div className="text-center text-sm text-red-500">{chatError}</div>}
            </div>

            <div className="border-t border-sky-100 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
              {!getToken() ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-slate-700 dark:text-slate-200">Log in to chat with support.</div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <textarea
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Write a message... (Enter to send)"
                    className="h-12 flex-1 resize-none rounded-lg border border-sky-200 p-2 focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || messageInput.trim() === ""}
                    className={`rounded-lg px-4 transition ${
                      sending ? "bg-slate-400 text-white" : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    }`}
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
