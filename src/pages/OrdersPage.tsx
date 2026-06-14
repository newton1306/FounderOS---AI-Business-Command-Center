import { useMemo, useState } from "react";
import { Bot, Search, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { chats } from "../data/source";
import { getOrderSummary } from "../lib/aiClient";
import { orderRisk, productById, relatedNotifications, userById } from "../lib/analytics";
import { currency, dateTime, number } from "../lib/format";
import { useUpdatePulse } from "../lib/useUpdatePulse";

export function OrdersPage(ctx: AppContext) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("latest");
  const [selected, setSelected] = useState(ctx.state.orders[0]?.order_id || "");
  const [summary, setSummary] = useState("");
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

  async function analyzeOrder() {
    if (!order) return;
    const result = await getOrderSummary(order, ctx.state);
    setSummary(result.data);
    ctx.setAiMode(result.mode);
    ctx.setAiReason(result.reason);
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
              <button className={`order-card ${selected === item.order_id ? "selected" : ""} ${updatePulse && index === 0 ? "pop-update" : ""}`} type="button" key={item.order_id} onClick={() => setSelected(item.order_id)}>
                <span className="order-card-main">
                  <span className="order-card-headline">
                    <strong>{item.order_id} -- {item.items.length} item(s) {number.format(item.total_price)}B</strong>
                    <span>{user?.name || "Unknown"} - {user?.role || "MEMBER"}</span>
                  </span>
                  <small>{dateTime(item.timestamp)} - {orderRisk(item, ctx.state.products)}</small>
                </span>
                <span className={`badge order-status ${item.status === "CANCELLED" ? "low" : item.status === "PENDING" ? "watch" : "healthy"}`}>{item.status}</span>
              </button>
            );
          }) : <div className="empty-state">No orders match this filter.</div>}
        </div>
        {order && customer && <aside className="panel detail-side">
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
          <div className="list">{chats.filter((chat) => chat.user_id === customer.user_id).slice(0, 2).map((chat) => <article className="list-item" key={chat.chat_id}><strong>{chat.chat_id} - {chat.status}</strong><span>{chat.messages.at(-1)?.text}</span></article>)}</div>
          <h4>Notifications</h4>
          <div className="list">{relatedNotifications(customer).slice(0, 2).map((item) => <article className="list-item" key={item.notif_id}><strong>{item.title}</strong><span>{item.message}</span><em>{dateTime(item.timestamp)}</em></article>)}</div>
          <button className="button primary ai-action" type="button" onClick={analyzeOrder}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>AI Order Summary</button>
          {summary && <div className="reply-box">{summary}</div>}
        </aside>}
      </div>
    </section>
  );
}
