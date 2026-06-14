import { chats, notifications, reviews, users } from "../data/source";
import type { ActivityItem, BusinessState, Order, Product, ProductInsight, Review, User } from "./types";

export function userById(id: string) {
  return users.find((user) => user.user_id === id);
}

export function productById(products: Product[], id: string) {
  return products.find((product) => product.product_id === id);
}

export function productReviews() {
  return reviews.filter((review) => review.target_type === "PRODUCT");
}

export function getProductInsights(state: BusinessState): ProductInsight[] {
  const productReviewList = productReviews();
  return state.products.map((product) => {
    const relatedOrders = state.orders.filter((order) => order.items.some((item) => item.product_id === product.product_id));
    const unitsSold = relatedOrders.reduce((sum, order) => sum + order.items.filter((item) => item.product_id === product.product_id).reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    const revenue = unitsSold * product.price;
    const relatedReviews = productReviewList.filter((review) => review.target_id === product.product_id);
    const averageRating = relatedReviews.length ? relatedReviews.reduce((sum, review) => sum + review.rating, 0) / relatedReviews.length : null;
    const negativeReviews = relatedReviews.filter((review) => review.rating <= 2).length;
    const stockStatus = product.stock <= 0 ? "out" : product.stock <= 5 ? "low" : product.stock <= 12 ? "watch" : "healthy";
    const risk = stockStatus === "low" || stockStatus === "out" ? "Stock risk" : negativeReviews > 0 ? "Review risk" : "Normal";
    return { product, unitsSold, revenue, averageRating, reviewCount: relatedReviews.length, negativeReviews, stockStatus, risk };
  });
}

export function getMetrics(state: BusinessState) {
  const insights = getProductInsights(state);
  const revenue = state.orders.filter((order) => order.status !== "CANCELLED").reduce((sum, order) => sum + order.total_price, 0);
  const statusSummary = state.orders.reduce<Record<string, number>>((summary, order) => {
    summary[order.status] = (summary[order.status] || 0) + 1;
    return summary;
  }, {});
  const openChats = chats.filter((chat) => chat.status === "OPEN");
  const productReviewList = productReviews();
  const avgRating = productReviewList.length ? productReviewList.reduce((sum, review) => sum + review.rating, 0) / productReviewList.length : 0;
  return {
    revenue,
    orders: state.orders.length,
    statusSummary,
    lowStock: insights.filter((item) => item.stockStatus === "low" || item.stockStatus === "out").length,
    openChats: openChats.length,
    avgRating,
    negativeReviews: productReviewList.filter((review) => review.rating <= 2).length
  };
}

export function revenueTrend(state: BusinessState) {
  const buckets = new Map<string, number>();
  state.orders.filter((order) => order.status !== "CANCELLED").forEach((order) => {
    const month = order.timestamp.slice(0, 7);
    buckets.set(month, (buckets.get(month) || 0) + order.total_price);
  });
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, revenue]) => ({ month, revenue }));
}

export function orderStatusBreakdown(state: BusinessState) {
  return Object.entries(getMetrics(state).statusSummary).map(([name, value]) => ({ name, value }));
}

export function revenueByCategory(state: BusinessState) {
  const byCategory = new Map<string, number>();
  state.orders.filter((order) => order.status !== "CANCELLED").forEach((order) => {
    order.items.forEach((item) => {
      const product = productById(state.products, item.product_id);
      if (product) byCategory.set(product.category, (byCategory.get(product.category) || 0) + product.price * item.qty);
    });
  });
  return [...byCategory.entries()].map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue);
}

export function stockRiskData(state: BusinessState) {
  return getProductInsights(state)
    .filter((item) => item.stockStatus !== "healthy")
    .sort((a, b) => a.product.stock - b.product.stock)
    .slice(0, 8)
    .map((item) => ({ name: item.product.name, stock: item.product.stock, unitsSold: item.unitsSold }));
}

export function getActivities(state: BusinessState): ActivityItem[] {
  const orderItems = state.orders.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 8).map((order) => {
    const user = userById(order.user_id);
    return {
      id: order.order_id,
      type: "order" as const,
      title: `${order.status} ${order.order_id}`,
      detail: `${user?.name || "Unknown customer"} placed order value ${order.total_price.toLocaleString("th-TH")} THB`,
      timestamp: order.timestamp,
      severity: order.status === "CANCELLED" ? "critical" as const : order.status === "PENDING" ? "warning" as const : "info" as const
    };
  });
  const reviewItems = productReviews().slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 5).map((review) => ({
    id: review.review_id,
    type: "review" as const,
    title: `Product review ${review.rating}/5`,
    detail: review.comment,
    timestamp: review.timestamp,
    severity: review.rating <= 2 ? "warning" as const : "success" as const
  }));
  const chatItems = chats.filter((chat) => chat.status === "OPEN").slice(0, 5).map((chat) => {
    const latest = chat.messages[chat.messages.length - 1];
    return {
      id: chat.chat_id,
      type: "chat" as const,
      title: `Open chat ${chat.chat_id}`,
      detail: latest?.text || "No message",
      timestamp: latest?.timestamp || new Date().toISOString(),
      severity: "warning" as const
    };
  });
  return [...state.simulationEvents, ...orderItems, ...reviewItems, ...chatItems]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 16);
}

export function detectChatTopic(text: string) {
  const normalized = text.toLowerCase();
  if (/ประกัน|warranty|เคลม|ซ่อม/.test(normalized)) return "Warranty";
  if (/ส่ง|พัสดุ|tracking|เลข/.test(normalized)) return "Shipping Status";
  if (/บุบ|เสียหาย|แตก|damaged/.test(normalized)) return "Damaged Package";
  if (/มีของ|พร้อมส่ง|stock|ของไหม/.test(normalized)) return "Product Availability";
  if (/ลด|discount|โปร/.test(normalized)) return "Discount Request";
  return "General";
}

export function orderRisk(order: Order, products: Product[]) {
  if (order.status === "CANCELLED") return "Cancelled revenue risk";
  if (order.status === "PENDING") return "Needs payment follow-up";
  const riskyItem = order.items.find((item) => (productById(products, item.product_id)?.stock || 0) <= 5);
  return riskyItem ? "Stock may block reorder" : "On track";
}

export function relatedNotifications(user: User) {
  return notifications.filter((notification) => notification.user_id === user.user_id);
}

export function reviewsForProduct(productId: string): Review[] {
  return productReviews().filter((review) => review.target_id === productId);
}
