import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp, Search } from "lucide-react";
import type { AppContext } from "../app/App";
import { getProductInsights } from "../lib/analytics";
import { currency } from "../lib/format";

export function ProductsPage(ctx: AppContext) {
  const insights = useMemo(() => getProductInsights(ctx.state), [ctx.state]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState("all");
  const [sort, setSort] = useState("revenue");
  const categories = [...new Set(ctx.state.products.map((product) => product.category))];
  const filtered = insights
    .filter((item) => item.product.name.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => category === "all" || item.product.category === category)
    .filter((item) => stock === "all" || item.stockStatus === stock)
    .sort((a, b) => {
      if (sort === "stock") return a.product.stock - b.product.stock;
      if (sort === "price") return b.product.price - a.product.price;
      if (sort === "sold") return b.unitsSold - a.unitsSold;
      if (sort === "rating") return (b.averageRating || 0) - (a.averageRating || 0);
      return b.revenue - a.revenue;
    });

  return (
    <section className="page-stack">
      <div className="section-head page-actions-head">
        <span className="pill">{filtered.length} products</span>
      </div>
      <div className="filters">
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product name" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={stock} onChange={(event) => setStock(event.target.value)} aria-label="Filter by stock">
          <option value="all">All stock</option>
          <option value="healthy">Healthy</option>
          <option value="watch">Watch</option>
          <option value="low">Low</option>
          <option value="out">Out</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
          <option value="revenue">Sort by revenue</option>
          <option value="stock">Sort by stock</option>
          <option value="price">Sort by price</option>
          <option value="sold">Sort by units sold</option>
          <option value="rating">Sort by rating</option>
        </select>
      </div>
      {filtered.length === 0 ? <div className="empty-state"><ArrowDownUp size={22} />No products match this filter.</div> : (
        <div className="product-grid">
          {filtered.map((item) => (
            <Link className="product-card" to={`/products/${item.product.product_id}`} key={item.product.product_id}>
              <img src={item.product.image} alt={item.product.name} loading="lazy" />
              <div>
                <div className="product-card-head">
                  <strong>{item.product.name}</strong>
                  <span className={`badge ${item.stockStatus}`}>{item.stockStatus}</span>
                </div>
                <p>{item.product.category}</p>
                <dl className="metric-row">
                  <div><dt>Price</dt><dd>{currency.format(item.product.price)}</dd></div>
                  <div><dt>Stock</dt><dd>{item.product.stock}</dd></div>
                  <div><dt>Sold</dt><dd>{item.unitsSold}</dd></div>
                  <div><dt>Revenue</dt><dd>{currency.format(item.revenue)}</dd></div>
                  <div><dt>Rating</dt><dd>{item.averageRating ? item.averageRating.toFixed(1) : "N/A"}</dd></div>
                </dl>
                <span className={`risk ${item.risk === "Normal" ? "ok" : "warn"}`}>{item.risk}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
