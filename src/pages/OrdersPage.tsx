import { useMemo, useRef, useState } from "react";
import { Bot, Search, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { chats } from "../data/source";
import { getOrderSummary } from "../lib/aiClient";
import { orderRisk, productById, relatedNotifications, userById } from "../lib/analytics";
import { currency, dateTime } from "../lib/format";
import { useUpdatePulse } from "../lib/useUpdatePulse";
import type { AiMode, Chat, ChatMessage } from "../lib/types";

export function OrdersPage(ctx: AppContext) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("latest");
  const [selected, setSelected] = useState(ctx.state.orders[0]?.order_id || "");
  const [summary, setSummary] = useState("");
  const [summaryMode, setSummaryMode] = useState<AiMode | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const updatePulse = useUpdatePulse(ctx.state.lastUpdated);

  const filtered = useMemo(() => ctx.state.orders.filter((order) => {
    const user = userById(order.user_id);
    const productNames = order.items.map((item) => productById(ctx.state.products, item.product_id)?.name || "").join(" ");
    const haystack = `${order.order_id} ${user?.name || ""} ${productNames}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "all" || order.status === status) && (role === "all" || user?.role === role);
  }).sort((a, b) => {
    if (sort === "value") return b.total_price - a.total_price;
    if (sort === "pending") return Number(b.status === "PENDING") - Number(a.status === "PENDING");
    if (sort === "cancelled") return Number(b.status === "CANCELLED") - Number(a.status === "CANCELLED");
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  }), [ctx.state, query, status, role, sort]);

  const order = ctx.state.orders.find((item) => item.order_id === selected) || filtered[0];
  const customer = order ? userById(order.user_id) : undefined;

  function selectOrder(orderId: string) {
    setSelected(orderId);
    if (window.innerWidth <= 820) {
      const jumpToDetail = () => {
        const detail = detailRef.current;
        if (!detail) return;
        (document.activeElement as HTMLElement | null)?.blur?.();
        const top = detail.getBoundingClientRect().top + window.scrollY - 12;
        document.scrollingElement?.scrollTo({ top, behavior: "auto" });
        window.scrollTo({ top, behavior: "auto" });
      };
      window.setTimeout(jumpToDetail, 120);
      window.setTimeout(jumpToDetail, 360);
    }
  }

  async function analyzeOrder() {
    if (!order) return;
    setSummaryLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getOrderSummary(order, ctx.state);
      setSummary(result.data);
      setSummaryMode(result.mode);
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <section className="page-stack orders-page">
      <div className="section-head page-actions-head">
        <span className="pill">{filtered.length} orders</span>
      </div>
      <div className="filters">
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, product" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by order status">
          <option value="all">All statuses</option><option>PENDING</option><option>PAID</option><option>SHIPPED</option><option>DELIVERED</option><option>CANCELLED</option>
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by customer role">
          <option value="all">All roles</option><option>VIP</option><option>MEMBER</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort orders">
          <option value="latest">Latest</option><option value="value">Highest value</option><option value="pending">Pending first</option><option value="cancelled">Cancelled first</option>
        </select>
      </div>
      <div className="orders-layout">
        <div className="orders-list">
          {filtered.length ? filtered.map((item, index) => {
            const user = userById(item.user_id);
            return (
              <button className={`order-card ${selected === item.order_id ? "selected" : ""} ${updatePulse && index === 0 ? "pop-update" : ""}`} type="button" key={item.order_id} onClick={() => selectOrder(item.order_id)}>
                <span className="order-card-main">
                  <span className="order-card-headline">
                    <strong>{item.order_id}</strong>
                    <span>{user?.name || "Unknown"} - {user?.role || "MEMBER"}</span>
                  </span>
                  <span className="order-card-metrics">
                    <span>{compactBaht(item.total_price)}</span>
                    <span>{`${item.items.length} ${item.items.length === 1 ? "item" : "items"}`}</span>
                  </span>
                  <small>{dateTime(item.timestamp)} - {orderRisk(item, ctx.state.products)}</small>
                </span>
                <span className={`badge order-status ${item.status === "CANCELLED" ? "low" : item.status === "PENDING" ? "watch" : "healthy"}`}>{item.status}</span>
              </button>
            );
          }) : <div className="empty-state">No orders match this filter.</div>}
        </div>
        {order && customer && <aside ref={detailRef} className="panel detail-side">
          <div className="gemini-cta-center order-gemini-cta">
            <button className="button primary ai-action gemini-cta-pulse" type="button" onClick={analyzeOrder} disabled={summaryLoading}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>{summaryLoading ? "Gemini is thinking..." : "Gemini Order Summary"}</button>
            <span className="cta-hand" aria-hidden="true">👆</span>
          </div>
          {summary && <div className="reply-box order-summary-result">{summaryMode === "fallback" && <FallbackNotice />}{summary}</div>}
          <h3>{order.order_id}</h3>
          <p className="summary">{customer.name} - {customer.role} - {customer.loyalty_points} loyalty points</p>
          <dl className="metric-row">
            <div><dt>Total</dt><dd>{currency.format(order.total_price)}</dd></div>
            <div><dt>Status</dt><dd>{order.status}</dd></div>
            <div><dt>Risk</dt><dd>{orderRisk(order, ctx.state.products)}</dd></div>
          </dl>
          <h4>Items purchased</h4>
          <div className="list">{order.items.map((item) => {
            const product = productById(ctx.state.products, item.product_id);
            return <article className="list-item" key={item.product_id}><strong>{product?.name || item.product_id}</strong><span>Qty {item.qty} - stock after order {product?.stock ?? "N/A"}</span></article>;
          })}</div>
          <h4>Related chats</h4>
          <div className="list">{chats.filter((chat) => chat.user_id === customer.user_id).slice(0, 2).map((chat) => {
            const chatState = getChatState(chat);
            const latest = chat.messages.at(-1);
            return (
              <article className="related-chat-card" key={chat.chat_id}>
                <div className="related-chat-head">
                  <strong>{chat.chat_id}</strong>
                  <span className={`chat-state-chip ${chatState.tone}`}>{chatState.label}</span>
                </div>
                <span className="related-chat-meta">{chat.status} - Last activity {dateTime(latest?.timestamp || order.timestamp)}</span>
                <ChatThreadPreview chat={chat} customerName={customer.name} />
              </article>
            );
          })}</div>
          <h4>Notifications</h4>
          <div className="list">{relatedNotifications(customer).slice(0, 2).map((item) => <article className="notification-event" key={item.notif_id}>
            <div className="notification-event-head">
              <strong>{item.title}</strong>
              <span className="notification-type">{item.type.replace(/_/g, " ")}</span>
            </div>
            <span className="notification-event-meta">{item.is_read ? "Read" : "Unread"} system notification</span>
            <p>{item.message}</p>
            <em>{dateTime(item.timestamp)}</em>
          </article>)}</div>
        </aside>}
      </div>
    </section>
  );
}

function FallbackNotice() {
  return <p className="fallback-result-label">This result is from fallback because the API rate limit was reached.</p>;
}

function compactBaht(value: number) {
  return `THB ${value.toLocaleString("en-US")}`;
}

function ChatThreadPreview({ chat, customerName }: { chat: Chat; customerName?: string }) {
  return (
    <div className="chat-thread-preview compact-thread-preview">
      {chat.messages.slice(-2).map((message, index) => (
        <div className={`thread-message ${message.sender === "USER" ? "customer" : "shop"}`} key={`${message.timestamp}-${index}`}>
          <span>{speakerLabel(message, customerName)}</span>
          <p>{message.text}</p>
        </div>
      ))}
    </div>
  );
}

function speakerLabel(message: ChatMessage, customerName?: string) {
  return message.sender === "USER" ? customerName || "Customer" : "Shop";
}

function chatNeedsReply(chat: Chat) {
  return chat.status === "OPEN" && chat.messages.at(-1)?.sender === "USER";
}

function getChatState(chat: Chat) {
  if (chat.status === "CLOSED") return { label: "Closed", tone: "closed" };
  if (chatNeedsReply(chat)) return { label: "Needs reply", tone: "needs-reply" };
  return { label: "Answered by shop", tone: "answered" };
}
