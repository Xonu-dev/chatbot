'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Bot, HeartPulse, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; text: string };
type ChatResponse = {
  conversation_id: string;
  reply: string;
  lead_status?: 'collecting' | 'awaiting_consent' | 'created' | 'failed';
  lead_created?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_CHATBOT_API_URL || 'https://karmaayurvedahospital.co/api/chatbot/api_end_point';
const STORAGE_KEY = 'karma-chat-conversation-id';
const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Hello! I'm the Karma Ayurveda assistant. Tell me what's bothering you, and I'll help you find the right next step.",
};

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) {
        setConversationId(existing);
        const historyUrl = new URL(API_URL, window.location.origin);
        historyUrl.searchParams.set('conversation_id', existing);
        void fetch(historyUrl.toString())
          .then(async (response) => {
            if (response.status === 404) {
              window.localStorage.removeItem(STORAGE_KEY);
              if (!cancelled) setConversationId('');
              return null;
            }
            if (!response.ok) return null;
            return (await response.json()) as { conversation_id: string; messages: Message[] };
          })
          .then((data) => {
            if (!cancelled && data?.messages?.length) setMessages(data.messages);
          })
          .catch(() => undefined);
      }
    } catch {
      // The conversation still works when browser storage is unavailable.
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener('open-health-chat', openChat);
    return () => window.removeEventListener('open-health-chat', openChat);
  }, []);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMessageId = createId();
    setMessages((current) => [...current, { id: userMessageId, role: 'user', text }]);
    setInput('');
    setError('');
    setBusy(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId || null, message: text }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<ChatResponse> & { error?: string };
      if (!response.ok || !data.reply || !data.conversation_id) {
        throw new Error(data.error || 'The assistant is unavailable right now. Please try again.');
      }

      setConversationId(data.conversation_id);
      try {
        window.localStorage.setItem(STORAGE_KEY, data.conversation_id);
      } catch {
        // Persistence of chat messages is handled by Django; this only remembers the session ID.
      }
      setMessages((current) => [...current, { id: createId(), role: 'assistant', text: data.reply! }]);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unable to send your message.';
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== userMessageId));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[2147483647] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label="Karma Ayurveda chat assistant" className="chat-pop-in flex h-[min(39rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.6rem] border border-emerald-900/10 bg-white shadow-[0_24px_80px_-20px_rgba(15,72,54,.38)]">
          <header className="flex items-center justify-between bg-gradient-to-r from-emerald-950 to-emerald-800 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"><Bot className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-semibold">Karma Ayurveda</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />Health assistant</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </header>

          <div className="flex items-start gap-2 border-b border-emerald-900/5 bg-emerald-50/70 px-4 py-2.5 text-[11px] leading-relaxed text-emerald-950/75">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p>Share only what you’re comfortable sharing. This assistant can offer general information, not a diagnosis or emergency care.</p>
          </div>

          <div ref={scrollRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#fbfcfa] px-4 py-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><HeartPulse className="h-4 w-4" /></div>}
                <p className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-emerald-800 text-white' : 'rounded-bl-md border border-emerald-900/5 bg-white text-slate-700 shadow-sm'}`}>{message.text}</p>
              </div>
            ))}
            {busy && <div className="ml-9 flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-700 [animation-delay:-0.3s]"/><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-700 [animation-delay:-0.15s]"/><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-700"/><span className="sr-only">Assistant is responding</span></div>}
            {error && <p role="alert" className="mx-9 text-xs text-red-700">{error} Your message is still in the box so you can retry.</p>}
          </div>

          <form onSubmit={(event) => void sendMessage(event)} className="border-t border-emerald-900/10 bg-white p-3.5">
            <div className="flex items-center gap-2 rounded-full border border-emerald-900/15 bg-slate-50 p-1.5 pl-4 transition focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/10">
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} maxLength={4000} disabled={busy} placeholder="Type your message..." aria-label="Your message" className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60" />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">For urgent symptoms, contact local emergency services.</p>
          </form>
        </section>
      )}

      {!open && <button type="button" onClick={() => setOpen(true)} className="flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-br from-emerald-700 to-emerald-950 px-4 text-white shadow-[0_12px_35px_-10px_rgba(6,78,59,.65)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30" aria-label="Open health chat">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><MessageCircle className="h-5 w-5" /></span><span className="pr-1 text-sm font-semibold">Chat with us</span>
      </button>}
    </div>
  );
}
