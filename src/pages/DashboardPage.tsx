import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, MessageSquareText, Send, Sparkles, TriangleAlert, Star, X } from "lucide-react";
import type { AppContext } from "../app/App";
import { getActivities, getMetrics, orderStatusBreakdown, revenueByCategory, revenueTrend, stockRiskData } from "../lib/analytics";
import { getChatbotAnswer, getFounderBrief } from "../lib/aiClient";
import { currency, dateTime, number } from "../lib/format";
import { useUpdatePulse } from "../lib/useUpdatePulse";

const pieColors = ["oklch(0.45 0.15 20)", "oklch(0.58 0.15 145)", "oklch(0.64 0.13 245)", "oklch(0.70 0.14 78)", "oklch(0.55 0.10 300)"];
const chartHeight = 146;

function shortLabel(value: string, max = 10) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function axisLabel(value: string, max = 10) {
  return shortLabel(value.replace(/\s+/g, " "), max).replace(/ /g, "\u00a0");
}

const SUGGEST_MESSAGES = [
  "Which products sell best?",
  "Any low stock items?",
  "Total revenue overview",
  "How many orders are there?",
  "Any negative reviews?"
];

export function DashboardPage(ctx: AppContext) {
  const metrics = useMemo(() => getMetrics(ctx.state), [ctx.state]);
  const [briefLoading, setBriefLoading] = useState(false);
  const assistantRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.innerWidth > 820) return;
    const id = window.requestAnimationFrame(() => {
      assistantRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  async function suggestBrief() {
    setBriefLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getFounderBrief(ctx.state);
      ctx.setFounderBrief(result.data);
      ctx.setFounderBriefMode(result.mode);
      ctx.setFounderBriefPopupOpen(true);
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
    } finally {
      setBriefLoading(false);
    }
  }

  return (
    <div className="page-grid dashboard-page">
      <section className="kpi-grid">
        <Kpi label="Total Revenue" value={currency.format(metrics.revenue)} detail={`${number.format(metrics.orders)} orders`} />
        <Kpi label="Order Status" value={`${metrics.statusSummary.PENDING || 0} pending`} detail={`${metrics.statusSummary.CANCELLED || 0} cancelled risk`} />
        <Kpi label="Stock Risk" value={metrics.lowStock.toString()} detail="products low or out" icon={<TriangleAlert size={18} />} />
        <Kpi label="Open Chats" value={metrics.openChats.toString()} detail="customer conversations" icon={<MessageSquareText size={18} />} />
        <Kpi label="Review Health" value={metrics.avgRating.toFixed(1)} detail={`${metrics.negativeReviews} negative reviews`} icon={<Star size={18} />} />
      </section>

      <section className="decision-panel ai-surface founder-brief">
        <div className="brief-ai-badges">
          <span className="brief-priority">Decision layer</span>
          <span className="ai-corner-star" aria-label="Gemini powered"><Star size={15} aria-hidden="true" /></span>
        </div>
        <div className="section-head">
          <Bot size={20} aria-hidden="true" />
          <div>
            <p className="caption">Gemini decision layer</p>
            <h2>Founder Action Brief</h2>
          </div>
        </div>
        {ctx.founderBriefMode === "fallback" && <FallbackNotice />}
        <p className="summary">{ctx.founderBrief?.summary || "No brief generated yet. Ask Gemini for a focused action plan from current revenue, stock, orders, reviews, and chats."}</p>
        {!ctx.founderBrief && (
          <div className="gemini-cta-center">
            <button className="button primary ai-action gemini-suggest gemini-cta-pulse" type="button" onClick={suggestBrief} disabled={briefLoading}>
              <span className="gemini-mark" aria-hidden="true"><Sparkles size={16} /></span>
              {briefLoading ? "Gemini is thinking..." : "Gemini Suggest"}
            </button>
            <span className="cta-hand" aria-hidden="true">👆</span>
          </div>
        )}
        {ctx.founderBrief && (
          <button className="button secondary ai-action gemini-refresh" type="button" onClick={suggestBrief} disabled={briefLoading}>
            <span className="gemini-mark" aria-hidden="true"><Sparkles size={15} /></span>
            {briefLoading ? "Updating..." : "Refresh Suggestion"}
          </button>
        )}
        <div className="action-list">
          {(ctx.founderBrief?.actions || []).map((action) => (
            <article className="action-item" key={action.title}>
              <strong>{action.title}</strong>
              <span>{action.reason}</span>
              <em>{action.impact}</em>
            </article>
          ))}
        </div>
      </section>

      {ctx.founderBrief && ctx.founderBriefPopupOpen && (
        <FounderBriefPopup ctx={ctx} />
      )}

      <section className="chart-grid">
        <ChartCard title="Revenue Trend" tone="trend">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={revenueTrend(ctx.state)} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.36 0.16 20)" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="oklch(0.36 0.16 20)" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.89 0.008 95)" strokeDasharray="3 7" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => currency.format(Number(v))} />
              <Area type="monotone" dataKey="revenue" fill="url(#revenueArea)" stroke="none" />
              <Line type="monotone" dataKey="revenue" stroke="oklch(0.33 0.17 20)" strokeWidth={3.6} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "oklch(0.33 0.17 20)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Order Status" tone="status">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={orderStatusBreakdown(ctx.state)} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={3} cornerRadius={6}>
                {orderStatusBreakdown(ctx.state).map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
              </Pie>
              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="donut-center-main">{metrics.orders}</text>
              <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="donut-center-sub">orders</text>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue by Category" tone="category">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={revenueByCategory(ctx.state).slice(0, 6)} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="categoryBars" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.66 0.14 145)" />
                  <stop offset="100%" stopColor="oklch(0.43 0.09 155)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.89 0.008 95)" strokeDasharray="3 7" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="category" tickFormatter={(value) => shortLabel(String(value), 10)} interval={0} width={70} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => currency.format(Number(v))} />
              <Bar dataKey="revenue" fill="url(#categoryBars)" radius={[0, 8, 8, 0]} barSize={11}>
                <LabelList dataKey="revenue" position="right" formatter={(value: number) => `${Math.round(value / 1000)}k`} className="chart-value-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        {/* Low Stock Watchlist: Card-based instead of BarChart */}
        <article className="chart-card chart-card-stock">
          <h3>Low Stock Watchlist</h3>
          <StockWatchlist state={ctx.state} />
        </article>
      </section>

      {/* Chatbot panel replaces Activity Feed */}
      <ChatbotPanel ctx={ctx} panelRef={assistantRef} />
    </div>
  );
}

function StockWatchlist({ state }: { state: AppContext["state"] }) {
  const items = stockRiskData(state).slice(0, 4);
  const maxThreshold = 20;
  if (!items.length) {
    return <div className="stock-watchlist-empty">✅ All products have healthy stock levels</div>;
  }
  return (
    <div className="stock-watchlist">
      {items.map((item) => {
        const pct = Math.min(100, (item.stock / maxThreshold) * 100);
        const isOut = item.stock <= 0;
        const isLow = item.stock > 0 && item.stock <= 5;
        return (
          <div className="stock-item" key={item.name}>
            <div className="stock-item-head">
              <strong>{shortLabel(item.name, 18)}</strong>
              {isOut && <span className="stock-badge out">OUT OF STOCK</span>}
              {isLow && <span className="stock-badge low">LOW</span>}
              {!isOut && !isLow && <span className="stock-badge watch">WATCH</span>}
            </div>
            <div className="stock-bar-track">
              <div
                className={`stock-bar-fill ${isOut ? "out" : isLow ? "low" : "watch"}`}
                style={{ width: `${Math.max(isOut ? 100 : pct, 4)}%` }}
              />
            </div>
            <div className="stock-item-meta">
              <span>{item.stock} units left</span>
              <span>{item.unitsSold} sold</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

function ChatbotPanel({ ctx, panelRef }: { ctx: AppContext; panelRef?: Ref<HTMLElement> }) {
  const messages = ctx.chatMessages;
  const setMessages = ctx.setChatMessages;
  const input = ctx.chatbotDraft;
  const loading = ctx.chatbotLoading;
  const setInput = ctx.setChatbotDraft;
  const setLoading = ctx.setChatbotLoading;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: document.activeElement === inputRef.current ? "auto" : "smooth", block: "nearest" });
  }, [messages]);

  // Product name autocomplete
  useEffect(() => {
    const q = input.toLowerCase().trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const matches = ctx.state.products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => p.name);
    setSuggestions(matches);
  }, [input, ctx.state.products]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setSuggestions([]);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getChatbotAnswer(trimmed, ctx.state);
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
      setMessages((prev) => [...prev, { role: "bot", text: result.data }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Sorry, an error occurred. Please try again." }]);
    }
    setLoading(false);
  }

  function insertProductName(name: string) {
    setInput((prev) => {
      // Replace last partial word with product name
      const words = prev.split(/\s+/);
      words[words.length - 1] = name;
      return words.join(" ") + " ";
    });
    setSuggestions([]);
    if (window.innerWidth > 820) inputRef.current?.focus();
  }

  return (
    <section className="chatbot-panel" id="store-assistant" ref={panelRef}>
      <div className="section-head">
        <div className="chatbot-head-left">
          <span className="chatbot-gemini-icon"><Sparkles size={16} /></span>
          <div>
            <p className="caption">Gemini Assistant</p>
            <h2>Ask about your store</h2>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <Bot size={32} />
            <p>Ask anything about your store</p>
            <div className="chat-suggest-grid">
              {SUGGEST_MESSAGES.map((msg) => (
                <button className="chat-suggest-btn" key={msg} type="button" onClick={() => sendMessage(msg)}>
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div className={`chat-bubble ${msg.role}`} key={i}>
            {msg.role === "bot" && <span className="chat-bubble-icon"><Sparkles size={12} /></span>}
            <div className="chat-bubble-text">{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble bot">
            <span className="chat-bubble-icon"><Sparkles size={12} /></span>
            <div className="chat-bubble-text chat-typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Product name suggestions */}
      {suggestions.length > 0 && (
        <div className="chat-product-suggestions">
          {suggestions.map((name) => (
            <button className="chat-product-pill" key={name} type="button" onClick={() => insertProductName(name)}>
              📦 {name}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
          placeholder="Ask about your store, e.g. how much stock is left..."
          disabled={loading}
        />
        <button className="chat-send-btn" type="button" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <Send size={16} />
        </button>
      </div>

      {/* Quick suggest after conversation started */}
      {messages.length > 0 && (
        <div className="chat-quick-suggests">
          {SUGGEST_MESSAGES.slice(0, 3).map((msg) => (
            <button className="chat-quick-btn" key={msg} type="button" onClick={() => sendMessage(msg)} disabled={loading}>
              {msg}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FounderBriefPopup({ ctx }: { ctx: AppContext }) {
  const brief = ctx.founderBrief;
  if (!brief) return null;
  return (
    <div className="brief-popup-backdrop" role="presentation">
      <section className="brief-popup" role="dialog" aria-modal="true" aria-labelledby="brief-popup-title">
        <div className="brief-popup-head">
          <div>
            <p className="caption">Gemini Suggest</p>
            <h2 id="brief-popup-title">What to do today</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => ctx.setFounderBriefPopupOpen(false)} aria-label="Close suggestion">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {ctx.founderBriefMode === "fallback" && <FallbackNotice />}
        <p className="summary">{brief.summary}</p>
        <div className="action-list">
          {brief.actions.map((action) => (
            <article className="action-item" key={action.title}>
              <strong>{action.title}</strong>
              <span>{action.reason}</span>
              <em>{action.impact}</em>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FallbackNotice() {
  return <p className="fallback-result-label">This result is from fallback because the API rate limit was reached.</p>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: React.ReactNode }) {
  return <article className="kpi-card">{icon && <div>{icon}</div>}<span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ChartCard({ title, tone, children }: { title: string; tone: "trend" | "status" | "category" | "stock"; children: React.ReactNode }) {
  return <article className={`chart-card chart-card-${tone}`}><h3>{title}</h3>{children}</article>;
}
