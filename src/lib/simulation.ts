import { users } from "../data/source";
import type { ActivityItem, BusinessState, Order } from "./types";

export function simulateLiveOrder(state: BusinessState): BusinessState {
  const vip = users.find((user) => user.role === "VIP") || users[0];
  const candidates = state.products.filter((product) => product.stock > 0).sort((a, b) => a.stock - b.stock);
  const product = candidates[0] || state.products[0];
  const qty = product.stock > 1 ? 1 : Math.max(1, product.stock);
  const now = new Date().toISOString();
  const nextOrderNumber = state.orders.length + 1;
  const order: Order = {
    order_id: `sim-${nextOrderNumber.toString().padStart(3, "0")}`,
    user_id: vip.user_id,
    items: [{ product_id: product.product_id, qty }],
    total_price: product.price * qty,
    status: "PAID",
    timestamp: now
  };
  const updatedProducts = state.products.map((item) => item.product_id === product.product_id ? { ...item, stock: Math.max(0, item.stock - qty) } : item);
  const updatedProduct = updatedProducts.find((item) => item.product_id === product.product_id) || product;
  const event: ActivityItem = {
    id: `event-${now}`,
    type: "simulation",
    title: vip.role === "VIP" ? "New VIP Order Received" : "New Order Received",
    detail: `${vip.name} ordered ${product.name} +฿${order.total_price.toLocaleString("th-TH")}. Stock left: ${updatedProduct.stock} units.`,
    timestamp: now,
    severity: updatedProduct.stock <= 5 ? "warning" : "success"
  };
  return {
    ...state,
    orders: [order, ...state.orders],
    products: updatedProducts,
    simulationEvents: [event, ...state.simulationEvents].slice(0, 20),
    lastUpdated: now
  };
}
