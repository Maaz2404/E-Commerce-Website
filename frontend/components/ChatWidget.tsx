"use client";

import { useRef, useState } from "react";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

type SupportMessage = {
  id: number;
  sender_type: "user" | "admin";
  message: string;
  is_read: boolean;
  created_at: string;
};

type BotMessage = { role: "user" | "assistant"; content: string };

type Mode = "bot" | "human";

type PendingConfirm = {
  sessionId: number;
  action: string;
  args: Record<string, unknown>;
  summary: string;
};

export default function ChatWidget() {
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("bot");

  // ---- Bot (LangGraph SSE) state ----
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [botInput, setBotInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef<number | null>(
    typeof window !== "undefined" && localStorage.getItem("chat_session_id")
      ? Number(localStorage.getItem("chat_session_id"))
      : null
  );

  // ---- Human support (existing /support/*) state ----
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  };

  const scrollToBottom = () => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  // ---------------- Bot streaming ----------------

  const appendToLastAssistant = (chunk: string) => {
    setBotMessages((m) => {
      const copy = [...m];
      copy[copy.length - 1] = {
        role: "assistant",
        content: copy[copy.length - 1].content + chunk,
      };
      return copy;
    });
    setTimeout(() => scrollToBottom(), 0);
  };

  /**
   * Read an SSE response from /chat/stream or /chat/resume. Streams tokens into
   * the current assistant bubble, tracks the session id, and handles the Phase 2
   * `interrupt` (confirm card) and `escalated` (switch to Human tab) frames.
   */
  const readSse = async (res: Response) => {
    if (!res.ok || !res.body) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error ?? `Chat failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";

      for (const frame of frames) {
        const ev = /^event:\s*(.+)$/m.exec(frame)?.[1];
        const dataLine = /^data:\s*(.*)$/m.exec(frame)?.[1] ?? "";
        let payload: any = {};
        try {
          payload = JSON.parse(dataLine);
        } catch {
          /* ignore non-JSON frames */
        }

        if (ev === "session" && payload.session_id) {
          sessionRef.current = payload.session_id;
          localStorage.setItem("chat_session_id", String(payload.session_id));
        } else if (ev === "interrupt") {
          // HITL Kind A — the graph paused for confirmation. Render a card.
          setPendingConfirm({
            sessionId: sessionRef.current as number,
            action: payload.action,
            args: payload.args ?? {},
            summary: payload.summary ?? "Please confirm this action.",
          });
          setTimeout(() => scrollToBottom(), 0);
          return; // stop reading; resume happens on the user's choice
        } else if (ev === "escalated") {
          // HITL Kind B — a human is taking over this thread. Switch to the
          // existing Human-support tab and load its history.
          setMode("human");
          loadMessages(getToken()).catch(() => {});
          return;
        } else if (ev === "done") {
          // stream finished
        } else if (payload.token) {
          appendToLastAssistant(payload.token);
        }
      }
    }
  };

  const sendBot = async () => {
    const text = botInput.trim();
    if (!text || streaming) return;

    const token = getToken();
    if (!token) {
      setChatError("You must be logged in to chat.");
      return;
    }
    setChatError(null);

    setBotMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setBotInput("");
    setStreaming(true);
    setTimeout(() => scrollToBottom(), 10);

    try {
      const res = await fetch(`${baseURL}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, session_id: sessionRef.current }),
      });
      await readSse(res);
    } catch (error: any) {
      console.error("sendBot error:", error);
      setChatError(error?.message ?? "Failed to reach the assistant");
      // drop the empty assistant bubble on error
      setBotMessages((m) => {
        const copy = [...m];
        if (copy.length && copy[copy.length - 1].content === "") copy.pop();
        return copy;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  // Confirm / deny a HITL action → resume the paused graph, stream continuation
  // into the current assistant bubble.
  const resolveConfirm = async (approved: boolean) => {
    if (!pendingConfirm) return;
    const { sessionId } = pendingConfirm;
    setPendingConfirm(null);

    const token = getToken();
    if (!token) return;

    // reuse the still-open assistant bubble (the one that showed "…")
    setStreaming(true);
    try {
      const res = await fetch(`${baseURL}/chat/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, approved }),
      });
      await readSse(res);
    } catch (error: any) {
      console.error("resolveConfirm error:", error);
      setChatError(error?.message ?? "Failed to complete the action");
    } finally {
      setStreaming(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  // "Talk to a human" → send a handoff message through the bot, which routes to
  // the Support agent and escalates.
  const talkToHuman = async () => {
    if (streaming) return;
    setBotInput("");
    setBotMessages((m) => [
      ...m,
      { role: "user", content: "I'd like to talk to a human agent." },
      { role: "assistant", content: "" },
    ]);
    const token = getToken();
    if (!token) {
      setChatError("You must be logged in to chat.");
      return;
    }
    setStreaming(true);
    setTimeout(() => scrollToBottom(), 10);
    try {
      const res = await fetch(`${baseURL}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: "I'd like to talk to a human agent.",
          session_id: sessionRef.current,
        }),
      });
      await readSse(res);
    } catch (error: any) {
      console.error("talkToHuman error:", error);
      setChatError(error?.message ?? "Failed to reach the assistant");
    } finally {
      setStreaming(false);
    }
  };

  // Image upload for a damaged-item report (story 8) → files a ticket with the
  // photo via multipart POST /tickets.
  const uploadDamagedItem = async (file: File) => {
    const token = getToken();
    if (!token) {
      setChatError("You must be logged in to upload.");
      return;
    }
    setUploading(true);
    setChatError(null);
    try {
      const form = new FormData();
      form.append("subject", "Damaged item report (from chat)");
      form.append("category", "damaged");
      if (sessionRef.current) form.append("chat_id", String(sessionRef.current));
      form.append("attachment", file);

      const res = await fetch(`${baseURL}/tickets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Upload failed (${res.status})`);

      setBotMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "📎 Thanks — I've attached your photo to a support ticket (#" +
            (json?.id ?? "?") +
            "). Tell me what happened and I'll help from here.",
        },
      ]);
      setTimeout(() => scrollToBottom(), 20);
    } catch (error: any) {
      console.error("uploadDamagedItem error:", error);
      setChatError(error?.message ?? "Failed to upload the image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------------- Human support (existing path) ----------------

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

  // ---------------- UI ----------------

  const openChat = async () => {
    setChatError(null);
    setChatOpen(true);
    if (mode === "human") {
      const token = getToken();
      if (token) await loadMessages(token);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatError(null);
  };

  const switchMode = async (next: Mode) => {
    setMode(next);
    setChatError(null);
    if (next === "human") {
      const token = getToken();
      if (token) await loadMessages(token);
    }
    setTimeout(() => scrollToBottom(), 50);
  };

  const onBotKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendBot();
    }
  };

  const onHumanKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const loggedIn = !!getToken();

  return (
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
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:w-96">
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 to-sky-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-semibold">
                {mode === "bot" ? "🤖" : "?"}
              </div>
              <div>
                <div className="font-semibold">
                  {mode === "bot" ? "Assistant" : "Support"}
                </div>
                <div className="text-xs opacity-90">
                  {mode === "bot"
                    ? "Ask about orders, shipping, returns…"
                    : "Call 03122417654 or chat here"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === "human" && (
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
              )}
              <button
                onClick={closeChat}
                className="px-2 text-xl font-bold"
                aria-label="Close support chat"
              >
                ×
              </button>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-sky-100 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => switchMode("bot")}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                mode === "bot"
                  ? "border-b-2 border-amber-400 text-slate-950 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              🤖 Assistant
            </button>
            <button
              onClick={() => switchMode("human")}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                mode === "human"
                  ? "border-b-2 border-amber-400 text-slate-950 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Human support
            </button>
          </div>

          <div
            ref={messagesRef}
            className="flex-1 space-y-3 overflow-auto bg-gradient-to-br from-sky-50 to-slate-50 px-3 py-3 dark:from-slate-950 dark:to-slate-900"
          >
            {!loggedIn && (
              <div className="text-center text-sm text-gray-600 dark:text-slate-300">
                You must be logged in to chat.
              </div>
            )}

            {/* ---- Bot conversation ---- */}
            {loggedIn && mode === "bot" && (
              <div className="space-y-2">
                {botMessages.length === 0 && (
                  <div className="text-center text-sm text-gray-600 dark:text-slate-300">
                    Say hi 👋 or ask about orders, shipping, returns, or payments.
                  </div>
                )}
                {botMessages.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={i}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] break-words rounded-lg px-3 py-2 text-sm ${
                          isUser
                            ? "rounded-br-none bg-gradient-to-r from-slate-950 to-sky-800 text-white"
                            : "rounded-bl-none border border-sky-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">
                          {m.content ||
                            (streaming && i === botMessages.length - 1 ? "…" : "")}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* HITL Kind A — confirm / deny card */}
                {pendingConfirm && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {pendingConfirm.summary}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => resolveConfirm(true)}
                        className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => resolveConfirm(false)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- Human support conversation ---- */}
            {loggedIn && mode === "human" && (
              <>
                {chatLoading && (
                  <div className="text-center text-sm text-gray-500 dark:text-slate-400">
                    Loading messages...
                  </div>
                )}
                {!chatLoading && chatMessages.length === 0 && (
                  <div className="text-center text-sm text-gray-600 dark:text-slate-300">
                    No messages yet. Send the first message and our team will reply soon.
                  </div>
                )}
                {!chatLoading && chatMessages.length > 0 && (
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
                            <div
                              className={`mt-1 text-xs ${
                                isUser ? "text-white/70" : "text-slate-500"
                              }`}
                            >
                              {new Date(message.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {chatError && (
              <div className="text-center text-sm text-red-500">{chatError}</div>
            )}
          </div>

          <div className="border-t border-sky-100 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
            {!loggedIn ? (
              <div className="text-sm text-slate-700 dark:text-slate-200">
                Log in to chat.
              </div>
            ) : mode === "bot" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  <button
                    onClick={talkToHuman}
                    disabled={streaming}
                    className="font-medium text-sky-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-sky-300"
                  >
                    🙋 Talk to a human
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="font-medium text-sky-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-sky-300"
                  >
                    {uploading ? "Uploading…" : "📎 Attach photo (damaged item)"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadDamagedItem(f);
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={botInput}
                    onChange={(event) => setBotInput(event.target.value)}
                    onKeyDown={onBotKeyDown}
                    placeholder="Message the assistant… (Enter to send)"
                    className="h-12 flex-1 resize-none rounded-lg border border-sky-200 p-2 focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    onClick={sendBot}
                    disabled={streaming || botInput.trim() === ""}
                    className={`rounded-lg px-4 transition ${
                      streaming
                        ? "bg-slate-400 text-white"
                        : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    }`}
                  >
                    {streaming ? "…" : "Send"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={onHumanKeyDown}
                  placeholder="Write a message... (Enter to send)"
                  className="h-12 flex-1 resize-none rounded-lg border border-sky-200 p-2 focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || messageInput.trim() === ""}
                  className={`rounded-lg px-4 transition ${
                    sending
                      ? "bg-slate-400 text-white"
                      : "bg-amber-400 text-slate-950 hover:bg-amber-300"
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
  );
}
