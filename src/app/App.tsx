import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Bot, Boxes, LayoutDashboard, MessageSquareText, PackageSearch, Radio, RefreshCcw, Search, ShoppingCart, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { chats, orders, products, users } from "../data/source";
import { getActivities, getMetrics } from "../lib/analytics";
import { clearFallbackCooldown, getFallbackUntil, getJson, setFallbackCooldown, setJson } from "../lib/storage";
import { simulateLiveOrder } from "../lib/simulation";
import { useOnlineStatus, usePwaReady } from "../lib/status";
import type { ActionBrief, AiMode, BusinessState } from "../lib/types";
import { DashboardPage } from "../pages/DashboardPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProductDetailPage } from "../pages/ProductDetailPage";
import { CustomerVoicePage } from "../pages/CustomerVoicePage";
import { OrdersPage } from "../pages/OrdersPage";
import { dateTime } from "../lib/format";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: PackageSearch },
  { to: "/voice", label: "Customer Voice", icon: MessageSquareText },
  { to: "/orders", label: "Orders", icon: ShoppingCart }
];

type NotificationTone = "success" | "warning" | "neutral";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/products/")) return "Product Detail";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/voice")) return "Customer Voice";
  if (pathname.startsWith("/orders")) return "Orders";
  return "Overview";
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<BusinessState>(() => ({
    orders,
    products,
    simulationEvents: [],
    lastUpdated: new Date().toISOString()
  }));
  const [aiMode, setAiMode] = useState<AiMode>(() => Date.now() < getFallbackUntil() ? "fallback" : "live");
  const [aiReason, setAiReason] = useState("ready");
  const [founderBrief, setFounderBrief] = useState<ActionBrief | null>(null);
  const [founderBriefMode, setFounderBriefMode] = useState<AiMode | null>(null);
  const [autoSim, setAutoSim] = useState(false);
  const [fallbackOnly, setFallbackOnly] = useState(() => getJson("ai_fallback_only", false));
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const online = useOnlineStatus();
  const pwaReady = usePwaReady();
  const metrics = useMemo(() => getMetrics(state), [state]);
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    if (!online) setAiMode("offline");
    else if (fallbackOnly || Date.now() < getFallbackUntil()) setAiMode("fallback");
    else setAiMode("live");
  }, [online, fallbackOnly]);

  useEffect(() => {
    if (!autoSim) return;
    const id = window.setInterval(() => simulate(), 9000);
    return () => window.clearInterval(id);
  }, [autoSim, state]);

  function simulate() {
    setState((current) => {
      const next = simulateLiveOrder(current);
      const event = next.simulationEvents[0];
      toast.success(event.title, { description: event.detail });
      if (event.severity === "warning") toast.warning("Low Stock Alert", { description: event.detail });
      return next;
    });
  }

  function toggleFallbackOnly(enabled: boolean) {
    setFallbackOnly(enabled);
    setJson("ai_fallback_only", enabled);
    if (enabled) {
      setFallbackCooldown(24 * 60);
      setAiMode("fallback");
      setAiReason("fallback only enabled");
      toast.info("Fallback Only Enabled", { description: "Gemini calls will use the local fallback path." });
      return;
    }
    clearFallbackCooldown();
    if (online) setAiMode("live");
    setAiReason("ready");
    toast.success("Fallback Only Off", { description: "Gemini can be used when available." });
  }

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const productResults = state.products
      .filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query))
      .slice(0, 3)
      .map((product) => ({ id: product.product_id, title: product.name, meta: `Product - ${product.category}`, to: `/products/${product.product_id}` }));
    const orderResults = state.orders
      .filter((order) => {
        const customer = users.find((user) => user.user_id === order.user_id);
        return `${order.order_id} ${order.status} ${customer?.name || ""}`.toLowerCase().includes(query);
      })
      .slice(0, 3)
      .map((order) => ({ id: order.order_id, title: order.order_id, meta: `Order - ${order.status}`, to: "/orders" }));
    const chatResults = chats
      .filter((chat) => {
        const customer = users.find((user) => user.user_id === chat.user_id);
        return `${chat.chat_id} ${chat.status} ${customer?.name || ""} ${chat.messages.at(-1)?.text || ""}`.toLowerCase().includes(query);
      })
      .slice(0, 2)
      .map((chat) => ({ id: chat.chat_id, title: users.find((user) => user.user_id === chat.user_id)?.name || chat.chat_id, meta: `Chat - ${chat.status}`, to: "/voice" }));
    return [...productResults, ...orderResults, ...chatResults].slice(0, 6);
  }, [searchQuery, state.orders, state.products]);

  const notificationItems = useMemo(() => {
    const activityItems = getActivities(state).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.detail,
      timestamp: item.timestamp,
      tone: (item.severity === "success" ? "success" : item.severity === "warning" || item.severity === "critical" ? "warning" : "neutral") as NotificationTone,
      to: item.type === "chat" || item.type === "review" ? "/voice" : "/orders"
    }));
    return activityItems
      .sort((a, b) => {
        const toneOrder = { success: 0, warning: 1, neutral: 2 } as const;
        const toneDiff = toneOrder[a.tone] - toneOrder[b.tone];
        return toneDiff || Date.parse(b.timestamp) - Date.parse(a.timestamp);
      })
      .slice(0, 8);
  }, [state.simulationEvents]);

  function goToResult(to: string) {
    navigate(to);
    setSearchOpen(false);
    setSearchQuery("");
    setNotificationsOpen(false);
    setMobileStatusOpen(false);
  }

  function submitSearch() {
    if (searchResults[0]) goToResult(searchResults[0].to);
    else setSearchOpen(true);
  }

  const context = { state, setState, aiMode, setAiMode, aiReason, setAiReason, founderBrief, setFounderBrief, founderBriefMode, setFounderBriefMode, online, pwaReady, simulate, autoSim, setAutoSim, forceFallback: () => toggleFallbackOnly(true) };
  const statusItems = [
    { icon: online ? Wifi : WifiOff, label: online ? "Online" : "Offline", tone: online ? "success" : "warning" },
    { icon: Radio, label: pwaReady ? "PWA Ready" : "PWA Pending", tone: pwaReady ? "success" : "neutral" },
    { icon: Bot, label: aiMode === "live" ? "Gemini Live" : aiMode === "cached" ? "Gemini Cached" : aiMode === "offline" ? "Gemini Offline" : "Gemini Fallback Active", tone: aiMode === "live" ? "success" : "warning" },
    { icon: RefreshCcw, label: `Updated ${dateTime(state.lastUpdated)}`, tone: "neutral" },
    { icon: BarChart3, label: aiReason, tone: "neutral" }
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>FounderOS</strong>
            <span>Gemini Command Center</span>
          </div>
        </div>
        <nav className="side-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-card">
          <Boxes size={18} aria-hidden="true" />
          <span>{metrics.lowStock} stock risks</span>
        </div>
        <div className="sidebar-utility" aria-hidden="true">
          <span></span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <p className="caption">FounderOS</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-tools">
            <label className="global-search" aria-label="Search FounderOS">
              <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); if (event.key === "Escape") setSearchOpen(false); }} placeholder="Search..." />
              <button type="button" onClick={submitSearch} aria-label="Run search"><Search size={18} aria-hidden="true" /></button>
            </label>
            <button className={`icon-button ${notificationsOpen ? "active" : ""}`} type="button" onClick={() => { setNotificationsOpen((value) => !value); setSearchOpen(false); }} aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} aria-hidden="true" />
            </button>
            {searchOpen && <SearchPanel query={searchQuery} results={searchResults} onClose={() => setSearchOpen(false)} onSelect={goToResult} />}
            {notificationsOpen && <NotificationPanel items={notificationItems} onClose={() => setNotificationsOpen(false)} onSelect={goToResult} />}
          </div>
        </header>

        {!online && <div className="banner warning"><WifiOff size={16} /> Offline mode active. Dashboard, products, orders, simulation, and local fallback remain available.</div>}

        <section className="status-bar" aria-label="System status">
          {statusItems.map((item) => <StatusChip key={item.label} icon={item.icon} label={item.label} tone={item.tone} />)}
          <label className="switch-row compact-switch">
            <span><strong>Fallback Only</strong></span>
            <input type="checkbox" checked={fallbackOnly} onChange={(event) => toggleFallbackOnly(event.target.checked)} />
          </label>
        </section>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage {...context} />} />
            <Route path="/products" element={<ProductsPage {...context} />} />
            <Route path="/products/:productId" element={<ProductDetailPage {...context} />} />
            <Route path="/voice" element={<CustomerVoicePage {...context} />} />
            <Route path="/orders" element={<OrdersPage {...context} />} />
          </Routes>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile primary">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button className={mobileStatusOpen ? "active" : ""} type="button" onClick={() => setMobileStatusOpen((value) => !value)} aria-expanded={mobileStatusOpen} aria-controls="mobile-status-drawer">
          <BarChart3 size={20} aria-hidden="true" />
          <span>Status</span>
        </button>
      </nav>

      <aside id="mobile-status-drawer" className={`mobile-status-drawer ${mobileStatusOpen ? "open" : ""}`} aria-hidden={!mobileStatusOpen}>
        <div className="section-head">
          <div>
            <p className="caption">System status</p>
            <h2>FounderOS Live</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setMobileStatusOpen(false)} aria-label="Close status panel">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="mobile-status-list">
          {statusItems.map((item) => <StatusChip key={item.label} icon={item.icon} label={item.label} tone={item.tone} />)}
        </div>
        <div className="mobile-status-actions utility-actions">
          <label className="global-search mobile-search" aria-label="Search FounderOS">
            <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); if (event.key === "Escape") setSearchOpen(false); }} placeholder="Search..." />
            <button type="button" onClick={submitSearch} aria-label="Run search"><Search size={18} aria-hidden="true" /></button>
          </label>
          <button className="button secondary" type="button" onClick={() => { setNotificationsOpen((value) => !value); setSearchOpen(false); }}>
            <Bell size={16} aria-hidden="true" />
            Notifications
          </button>
          <label className="switch-row">
            <span><strong>Fallback Only</strong><small>{fallbackOnly ? "Local fallback is forced" : "Gemini when available"}</small></span>
            <input type="checkbox" checked={fallbackOnly} onChange={(event) => toggleFallbackOnly(event.target.checked)} />
          </label>
        </div>
        {searchOpen && <SearchPanel query={searchQuery} results={searchResults} onClose={() => setSearchOpen(false)} onSelect={goToResult} />}
        {notificationsOpen && <NotificationPanel items={notificationItems} onClose={() => setNotificationsOpen(false)} onSelect={goToResult} />}
      </aside>
    </div>
  );
}

function SearchPanel({ query, results, onClose, onSelect }: { query: string; results: Array<{ id: string; title: string; meta: string; to: string }>; onClose: () => void; onSelect: (to: string) => void }) {
  return (
    <section className="floating-panel search-panel" aria-label="Search results">
      <div className="section-head"><h2>Search</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close search"><X size={15} /></button></div>
      <div className="floating-list">
        {!query.trim() ? <p className="panel-empty">Type a product, order, customer, or chat.</p> : results.length ? results.map((item) => (
          <button className="floating-item" type="button" key={item.id} onClick={() => onSelect(item.to)}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
          </button>
        )) : <p className="panel-empty">No matching results.</p>}
      </div>
    </section>
  );
}

function NotificationPanel({ items, onClose, onSelect }: { items: Array<{ id: string; title: string; message: string; timestamp: string; tone: NotificationTone; to: string }>; onClose: () => void; onSelect: (to: string) => void }) {
  return (
    <section className="floating-panel notification-panel" aria-label="Notifications">
      <div className="section-head"><h2>Notifications</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close notifications"><X size={15} /></button></div>
      <div className="floating-list">
        {items.map((item) => (
          <button className={`floating-item ${item.tone}`} type="button" key={item.id} onClick={() => onSelect(item.to)}>
            <strong>{item.title}</strong>
            <span>{item.message}</span>
            <em>{dateTime(item.timestamp)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusChip({ icon: Icon, label, tone }: { icon: typeof Wifi; label: string; tone: "success" | "warning" | "neutral" }) {
  return <span className={`status-chip ${tone}`}><Icon size={15} aria-hidden="true" />{label}</span>;
}

export type AppContext = {
  state: BusinessState;
  setState: React.Dispatch<React.SetStateAction<BusinessState>>;
  aiMode: AiMode;
  setAiMode: (mode: AiMode) => void;
  aiReason: string;
  setAiReason: (reason: string) => void;
  founderBrief: ActionBrief | null;
  setFounderBrief: (brief: ActionBrief | null) => void;
  founderBriefMode: AiMode | null;
  setFounderBriefMode: (mode: AiMode | null) => void;
  online: boolean;
  pwaReady: boolean;
  simulate: () => void;
  autoSim: boolean;
  setAutoSim: (value: boolean) => void;
  forceFallback: () => void;
};
