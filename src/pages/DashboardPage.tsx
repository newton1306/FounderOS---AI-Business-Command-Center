import { useMemo, useState } from "react";
import { Cell, Line, LineChart, Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, MessageSquareText, Sparkles, TriangleAlert, Star, ToggleLeft, ToggleRight } from "lucide-react";
import type { AppContext } from "../app/App";
import { getActivities, getMetrics, orderStatusBreakdown, revenueByCategory, revenueTrend, stockRiskData } from "../lib/analytics";
import { getFounderBrief } from "../lib/aiClient";
import type { ActionBrief, AiMode } from "../lib/types";
import { currency, dateTime, number } from "../lib/format";
import { useUpdatePulse } from "../lib/useUpdatePulse";

const pieColors = ["oklch(0.45 0.15 20)", "oklch(0.58 0.15 145)", "oklch(0.64 0.13 245)", "oklch(0.70 0.14 78)", "oklch(0.55 0.10 300)"];
const chartHeight = 146;

function shortLabel(value: string, max = 10) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export function DashboardPage(ctx: AppContext) {
  const metrics = useMemo(() => getMetrics(ctx.state), [ctx.state]);
  const activities = useMemo(() => getActivities(ctx.state), [ctx.state]);
  const [brief, setBrief] = useState<ActionBrief | null>(null);
  const [briefMode, setBriefMode] = useState<AiMode | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const updatePulse = useUpdatePulse(ctx.state.lastUpdated);

  async function suggestBrief() {
    setBriefLoading(true);
    const result = await getFounderBrief(ctx.state);
    setBrief(result.data);
    setBriefMode(result.mode);
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
        <span className="ai-corner-star" aria-label="Gemini powered"><Star size={15} aria-hidden="true" /></span>
        <div className="section-head">
          <div>
            <p className="caption">Gemini decision layer</p>
            <h2>Founder Action Brief</h2>
          </div>
          <Bot size={20} aria-hidden="true" />
        </div>
        {briefMode === "fallback" && <FallbackNotice />}
        <p className="summary">{brief?.summary || "No brief generated yet. Ask Gemini for a focused action plan from current revenue, stock, orders, reviews, and chats."}</p>
        {!brief && (
          <button className="button primary ai-action gemini-suggest" type="button" onClick={suggestBrief} disabled={briefLoading}>
            <span className="gemini-mark" aria-hidden="true"><Sparkles size={16} /></span>
            {briefLoading ? "Gemini is thinking..." : "Gemini Suggest"}
          </button>
        )}
        {brief && (
          <button className="button secondary ai-action gemini-refresh" type="button" onClick={suggestBrief} disabled={briefLoading}>
            <span className="gemini-mark" aria-hidden="true"><Sparkles size={15} /></span>
            {briefLoading ? "Updating..." : "Refresh Suggestion"}
          </button>
        )}
        <div className="action-list">
          {(brief?.actions || []).map((action) => (
            <article className="action-item" key={action.title}>
              <strong>{action.title}</strong>
              <span>{action.reason}</span>
              <em>{action.impact}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="chart-grid">
        <ChartCard title="Revenue Trend">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={revenueTrend(ctx.state)}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => currency.format(Number(v))} />
              <Line dataKey="revenue" stroke="oklch(0.45 0.15 20)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Order Status">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie data={orderStatusBreakdown(ctx.state)} dataKey="value" nameKey="name" innerRadius={34} outerRadius={55} paddingAngle={2}>
                {orderStatusBreakdown(ctx.state).map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={revenueByCategory(ctx.state)}>
              <XAxis dataKey="category" tickFormatter={(value) => shortLabel(String(value), 9)} interval={0} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} width={44} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => currency.format(Number(v))} />
              <Bar dataKey="revenue" fill="oklch(0.58 0.15 145)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Low Stock Watchlist">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={stockRiskData(ctx.state).slice(0, 6)} layout="vertical" margin={{ left: 4, right: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tickFormatter={(value) => shortLabel(String(value), 11)} interval={0} width={78} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="stock" fill="oklch(0.70 0.14 78)" radius={[0, 6, 6, 0]} />
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
  return <p className="fallback-result-label">{"\u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e19\u0e35\u0e49\u0e21\u0e32\u0e08\u0e32\u0e01 fallback"}</p>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: React.ReactNode }) {
  return <article className="kpi-card">{icon && <div>{icon}</div>}<span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="chart-card"><h3>{title}</h3>{children}</article>;
}
