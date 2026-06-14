import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, PackageCheck, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { getProductInsight } from "../lib/aiClient";
import { getProductInsights, reviewsForProduct, userById } from "../lib/analytics";
import type { ActionBrief, AiMode } from "../lib/types";
import { currency, dateTime } from "../lib/format";

export function ProductDetailPage(ctx: AppContext) {
  const { productId } = useParams();
  const insight = useMemo(() => getProductInsights(ctx.state).find((item) => item.product.product_id === productId), [ctx.state, productId]);
  const [ai, setAi] = useState<ActionBrief | null>(null);
  const [aiMode, setAiMode] = useState<AiMode | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"ai" | "orders" | "reviews">("ai");
  if (!insight) return <div className="empty-state">Product not found.</div>;
  const product = insight.product;
  const relatedOrders = ctx.state.orders.filter((order) => order.items.some((item) => item.product_id === product.product_id));
  const relatedReviews = reviewsForProduct(product.product_id);

  async function analyze() {
    setAiLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getProductInsight(product, ctx.state);
      setAi(result.data);
      setAiMode(result.mode);
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="page-stack product-detail-page">
      <Link className="inline-link" to="/products"><ArrowLeft size={16} /> Back to products</Link>
      <div className="detail-header">
        <img src={product.image} alt={product.name} />
        <div>
          <p className="caption">{product.category}</p>
          <h2>{product.name}</h2>
          <p className="summary">Stock impact: {product.stock <= 5 ? "urgent restock risk" : "inventory is usable but should be watched against order velocity"}.</p>
          <button className="button primary ai-action" type="button" onClick={analyze} disabled={aiLoading}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>{aiLoading ? "Gemini is thinking..." : "Gemini Product Insight"}</button>
        </div>
      </div>
      <div className="kpi-grid compact">
        <Metric label="Revenue" value={currency.format(insight.revenue)} />
        <Metric label="Units Sold" value={String(insight.unitsSold)} />
        <Metric label="Stock Left" value={String(product.stock)} />
        <Metric label="Avg Rating" value={insight.averageRating ? insight.averageRating.toFixed(1) : "N/A"} />
      </div>
      <div className="mobile-segment" aria-label="Product detail sections">
        <button className={mobileTab === "ai" ? "active" : ""} type="button" onClick={() => setMobileTab("ai")}>Gemini</button>
        <button className={mobileTab === "orders" ? "active" : ""} type="button" onClick={() => setMobileTab("orders")}>Orders</button>
        <button className={mobileTab === "reviews" ? "active" : ""} type="button" onClick={() => setMobileTab("reviews")}>Reviews</button>
      </div>
      <section className="decision-panel product-detail-panel ai-surface" data-mobile-panel={mobileTab === "ai" ? "active" : "hidden"}>
        <span className="ai-corner-star" aria-label="Gemini powered"><Star size={15} aria-hidden="true" /></span>
        <div className="section-head"><h2>Gemini Product Insight</h2><PackageCheck size={20} /></div>
        {aiMode === "fallback" && <FallbackNotice />}
        <p className="summary">{ai?.summary || "Click Gemini Product Insight for a product-specific live Gemini insight."}</p>
        <div className="action-list">{ai?.actions.map((action) => <article className="action-item" key={action.title}><strong>{action.title}</strong><span>{action.reason}</span><em>{action.impact}</em></article>)}</div>
      </section>
      <div className="two-column product-detail-sections">
        <section className="panel" data-mobile-panel={mobileTab === "orders" ? "active" : "hidden"}>
          <h3>Related Orders</h3>
          <div className="list">
            {relatedOrders.slice(0, 8).map((order) => <article className="list-item" key={order.order_id}><strong>{order.order_id}</strong><span>{userById(order.user_id)?.name || "Unknown"} - {order.status}</span><em>{currency.format(order.total_price)} - {dateTime(order.timestamp)}</em></article>)}
          </div>
        </section>
        <section className="panel" data-mobile-panel={mobileTab === "reviews" ? "active" : "hidden"}>
          <h3>Product Reviews</h3>
          <div className="list">
            {relatedReviews.length ? relatedReviews.map((review) => <article className="list-item" key={review.review_id}><strong>{review.rating}/5 - {userById(review.user_id)?.name || "Customer"}</strong><span>{review.comment}</span><em>{dateTime(review.timestamp)}</em></article>) : <div className="empty-state">No reviews available.</div>}
          </div>
        </section>
      </div>
    </section>
  );
}

function FallbackNotice() {
  return <p className="fallback-result-label">This result is from fallback because the API rate limit was reached.</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="kpi-card"><span>{label}</span><strong>{value}</strong></article>;
}
