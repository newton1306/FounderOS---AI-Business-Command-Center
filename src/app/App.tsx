import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Bot, LayoutDashboard, MessageSquareText, PackageSearch, Radio, RefreshCcw, Search, ShoppingCart, ToggleLeft, ToggleRight, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { chats, orders, products, users } from "../data/source";
import { getActivities, getMetrics } from "../lib/analytics";
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

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth <= 820;
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
  const [aiMode, setAiMode] = useState<AiMode>("live");
  const [aiReason, setAiReason] = useState("ready");
  const [founderBrief, setFounderBrief] = useState<ActionBrief | null>(null);
  const [founderBriefMode, setFounderBriefMode] = useState<AiMode | null>(null);
  const [founderBriefPopupOpen, setFounderBriefPopupOpen] = useState(false);
  const [autoSim, setAutoSim] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "bot"; text: string}>>([]);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotDraft, setChatbotDraft] = useState("");
  const [voiceSummary, setVoiceSummary] = useState<{data: ActionBrief; mode: AiMode} | null>(null);
  const [voiceSummaryLoading, setVoiceSummaryLoading] = useState(false);
  const [chatReplies, setChatReplies] = useState<Record<string, { text: string; mode: AiMode }>>({});
  const [chatReplyLoading, setChatReplyLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const online = useOnlineStatus();
  const pwaReady = usePwaReady();
  const metrics = useMemo(() => getMetrics(state), [state]);
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    if (!online) setAiMode("offline");
    else setAiMode("live");
    setAiReason(online ? "ready" : "offline");
  }, [online]);

  useEffect(() => {
    if (!autoSim) return;
    const id = window.setInterval(() => simulate(), 9000);
    return () => window.clearInterval(id);
  }, [autoSim, state]);

  function simulate() {
    setState((current) => {
      const next = simulateLiveOrder(current);
      const event = next.simulationEvents[0];
      setUnreadCount((c) => c + 1);
      const toastOptions = isMobileViewport()
        ? { description: event.detail, duration: 3500, position: "top-center" as const }
        : { description: event.detail };
      if (event.severity === "warning" || event.severity === "critical") toast.warning(event.title, toastOptions);
      else toast.success(event.title, toastOptions);
      return next;
    });
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

  // Notifications: show only simulation events, green (success) first
  const notificationItems = useMemo(() => {
    const activityItems = state.simulationEvents.map((item) => ({
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
      });
  }, [state.simulationEvents]);

  function goToResult(to: string) {
    navigate(to);
    setSearchOpen(false);
    setSearchQuery("");
    setNotificationsOpen(false);
  }

  function submitSearch() {
    if (searchResults[0]) goToResult(searchResults[0].to);
    else setSearchOpen(true);
  }

  const context = { state, setState, aiMode, setAiMode, aiReason, setAiReason, founderBrief, setFounderBrief, founderBriefMode, setFounderBriefMode, founderBriefPopupOpen, setFounderBriefPopupOpen, online, pwaReady, simulate, autoSim, setAutoSim, chatMessages, setChatMessages, chatbotLoading, setChatbotLoading, chatbotDraft, setChatbotDraft, voiceSummary, setVoiceSummary, voiceSummaryLoading, setVoiceSummaryLoading, chatReplies, setChatReplies, chatReplyLoading, setChatReplyLoading };
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
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <p className="caption">FounderOS</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-tools">
            {/* Auto Simulation toggle in topbar */}
            <label className="topbar-sim-toggle" title="Auto Simulation">
              <input type="checkbox" checked={autoSim} onChange={(event) => setAutoSim(event.target.checked)} />
              {autoSim ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              <span className="topbar-sim-label">Auto Sim</span>
            </label>
            <label className="global-search" aria-label="Search FounderOS">
              <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); if (event.key === "Escape") setSearchOpen(false); }} placeholder="Search..." />
              <button type="button" onClick={submitSearch} aria-label="Run search"><Search size={18} aria-hidden="true" /></button>
            </label>
            <button className={`icon-button noti-button ${notificationsOpen ? "active" : ""}`} type="button" onClick={() => { setNotificationsOpen((value) => !value); setSearchOpen(false); setUnreadCount(0); }} aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={17} aria-hidden="true" />
              {unreadCount > 0 && <span className="noti-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            {searchOpen && <SearchPanel query={searchQuery} results={searchResults} onClose={() => setSearchOpen(false)} onSelect={goToResult} />}
            {notificationsOpen && <NotificationPanel items={notificationItems} onClose={() => setNotificationsOpen(false)} onSelect={goToResult} />}
          </div>
        </header>

        {!online && <div className="banner warning"><WifiOff size={16} /> Offline mode active. Dashboard, products, orders, simulation, and local fallback remain available.</div>}

        <section className="status-bar" aria-label="System status">
          {statusItems.map((item) => <StatusChip key={item.label} icon={item.icon} label={item.label} tone={item.tone} />)}
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

      {/* Mobile nav: 4 items only (no Status) */}
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
      </nav>
      <button
        className={`mobile-auto-sim status-chip ${autoSim ? "success" : "neutral"}`}
        type="button"
        onClick={() => setAutoSim((value) => !value)}
        aria-pressed={autoSim}
        aria-label={autoSim ? "Turn off auto simulation" : "Turn on auto simulation"}
      >
        {autoSim ? <ToggleRight size={18} aria-hidden="true" /> : <ToggleLeft size={18} aria-hidden="true" />}
        Auto Sim
      </button>
    </div>
  );
}

// Search panel: closes on click-outside, no X button
function SearchPanel({ query, results, onClose, onSelect }: { query: string; results: Array<{ id: string; title: string; meta: string; to: string }>; onClose: () => void; onSelect: (to: string) => void }) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Also don't close if clicking the search input
        const target = event.target as HTMLElement;
        if (target.closest(".global-search")) return;
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <section ref={panelRef} className="floating-panel search-panel" aria-label="Search results">
      <div className="section-head"><h2>Search</h2></div>
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
        {items.length === 0 ? <p className="panel-empty">No new notifications. Waiting for new events...</p> : items.map((item) => (
          <button className={`floating-item ${item.tone}`} type="button" key={item.id} onClick={() => onSelect(item.to)}>
            <strong>{item.title}</strong>
            <small>{item.tone === "warning" ? "Action notification" : item.tone === "success" ? "Success notification" : "System notification"}</small>
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
  founderBriefPopupOpen: boolean;
  setFounderBriefPopupOpen: (value: boolean) => void;
  online: boolean;
  pwaReady: boolean;
  simulate: () => void;
  autoSim: boolean;
  setAutoSim: (value: boolean) => void;
  chatMessages: Array<{role: "user" | "bot"; text: string}>;
  setChatMessages: React.Dispatch<React.SetStateAction<Array<{role: "user" | "bot"; text: string}>>>;
  chatbotLoading: boolean;
  setChatbotLoading: (value: boolean) => void;
  chatbotDraft: string;
  setChatbotDraft: React.Dispatch<React.SetStateAction<string>>;
  voiceSummary: {data: ActionBrief; mode: AiMode} | null;
  setVoiceSummary: (value: {data: ActionBrief; mode: AiMode} | null) => void;
  voiceSummaryLoading: boolean;
  setVoiceSummaryLoading: (value: boolean) => void;
  chatReplies: Record<string, { text: string; mode: AiMode }>;
  setChatReplies: React.Dispatch<React.SetStateAction<Record<string, { text: string; mode: AiMode }>>>;
  chatReplyLoading: Record<string, boolean>;
  setChatReplyLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};
