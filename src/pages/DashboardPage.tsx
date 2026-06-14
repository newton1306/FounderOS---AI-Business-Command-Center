import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, MessageSquareText, Sparkles, TriangleAlert, Star, ToggleLeft, ToggleRight } from "lucide-react";
import type { AppContext } from "../app/App";
import { getActivities, getMetrics, orderStatusBreakdown, revenueByCategory, revenueTrend, stockRiskData } from "../lib/analytics";
import { getFounderBrief } from "../lib/aiClient";
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

export function DashboardPage(ctx: AppContext) {
  const metrics = useMemo(() => getMetrics(ctx.state), [ctx.state]);
  const activities = useMemo(() => getActivities(ctx.state), [ctx.state]);
  const [briefLoading, setBriefLoading] = useState(false);
  const updatePulse = useUpdatePulse(ctx.state.lastUpdated);

  async function suggestBrief() {
    setBriefLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    const result = await getFounderBrief(ctx.state);
    ctx.setFounderBrief(result.data);
    ctx.setFounderBriefMode(result.mode);
    ctx.setAiMode(result.mode);
    ctx.setAiReason(result.reason);
    setBriefLoading(false);
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
          <button className="button primary ai-action gemini-suggest" type="button" onClick={suggestBrief} disabled={briefLoading}>
            <span className="gemini-mark" aria-hidden="true"><Sparkles size={16} /></span>
            {briefLoading ? "Gemini is thinking..." : "Gemini Suggest"}
          </button>
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
        <ChartCard title="Low Stock Watchlist" tone="stock">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={stockRiskData(ctx.state).slice(0, 4)} layout="vertical" margin={{ left: 0, right: 30, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="stockBars" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.72 0.13 78)" />
                  <stop offset="100%" stopColor="oklch(0.58 0.14 42)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.89 0.008 95)" strokeDasharray="3 7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tickFormatter={(value) => axisLabel(String(value), 12)} interval={0} width={94} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="stock" fill="url(#stockBars)" radius={[0, 8, 8, 0]} barSize={12}>
                <LabelList dataKey="stock" position="right" formatter={(value: number) => value > 0 ? value : ""} className="chart-value-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="activity-panel">
        <div className="section-head">
          <div>
            <p className="caption">Live operations</p>
            <h2>Activity Feed</h2>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={ctx.autoSim} onChange={(event) => ctx.setAutoSim(event.target.checked)} />
            {ctx.autoSim ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            Auto Simulation
          </label>
        </div>
        <div className="feed-list">
          {activities.map((item, index) => (
            <article className={`feed-item ${item.severity || "info"} ${updatePulse && index === 0 ? "pop-update" : ""}`} key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
              <time>{dateTime(item.timestamp)}</time>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FallbackNotice() {
  return <p className="fallback-result-label">ผลลัพธ์นี้มาจาก fallback  เนื่องจาก API rate limit</p>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: React.ReactNode }) {
  return <article className="kpi-card">{icon && <div>{icon}</div>}<span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ChartCard({ title, tone, children }: { title: string; tone: "trend" | "status" | "category" | "stock"; children: React.ReactNode }) {
  return <article className={`chart-card chart-card-${tone}`}><h3>{title}</h3>{children}</article>;
}
