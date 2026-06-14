export type UserRole = "MEMBER" | "VIP";
export type OrderStatus = "DELIVERED" | "SHIPPED" | "PENDING" | "PAID" | "CANCELLED";
export type ChatStatus = "OPEN" | "CLOSED";
export type AiMode = "live" | "fallback" | "cached" | "offline";

export interface User {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  loyalty_points: number;
  role: UserRole;
}

export interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
}

export interface OrderItem {
  product_id: string;
  qty: number;
}

export interface Order {
  order_id: string;
  user_id: string;
  items: OrderItem[];
  total_price: number;
  status: OrderStatus;
  timestamp: string;
}

export interface Review {
  review_id: string;
  user_id: string;
  target_id: string;
  target_type: "HOTEL" | "DOCTOR" | "PRODUCT";
  rating: number;
  comment: string;
  timestamp: string;
  images: string[];
}

export interface ChatMessage {
  sender: "USER" | "SHOP";
  text: string;
  timestamp: string;
}

export interface Chat {
  chat_id: string;
  user_id: string;
  shop_id: string;
  status: ChatStatus;
  messages: ChatMessage[];
}

export interface Notification {
  notif_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  timestamp: string;
  action_link: string;
}

export interface Location {
  location_id: string;
  name: string;
  type: string;
  ref_id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  operating_hours: string;
}

export interface ProductInsight {
  product: Product;
  unitsSold: number;
  revenue: number;
  averageRating: number | null;
  reviewCount: number;
  negativeReviews: number;
  stockStatus: "healthy" | "watch" | "low" | "out";
  risk: string;
}

export interface ActionBrief {
  summary: string;
  actions: Array<{
    title: string;
    reason: string;
    impact: string;
    source: "gemini" | "local-fallback";
  }>;
}

export interface ActivityItem {
  id: string;
  type: "order" | "review" | "chat" | "simulation";
  title: string;
  detail: string;
  timestamp: string;
  severity?: "info" | "warning" | "critical" | "success";
}

export interface BusinessState {
  orders: Order[];
  products: Product[];
  simulationEvents: ActivityItem[];
  lastUpdated: string;
}
