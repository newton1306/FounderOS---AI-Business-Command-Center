import usersJson from "../../Hackathon_Data_Pack/data/users.json";
import productsJson from "../../Hackathon_Data_Pack/data/1. ระบบร้านค้า (E-commerce)/products.json";
import ordersJson from "../../Hackathon_Data_Pack/data/1. ระบบร้านค้า (E-commerce)/ecommerce_orders.json";
import reviewsJson from "../../Hackathon_Data_Pack/data/10. common/reviews.json";
import chatsJson from "../../Hackathon_Data_Pack/data/10. common/chats.json";
import notificationsJson from "../../Hackathon_Data_Pack/data/10. common/notifications.json";
import locationsJson from "../../Hackathon_Data_Pack/data/10. common/locations.json";
import type { Chat, Location, Notification, Order, Product, Review, User } from "../lib/types";

export const users = usersJson as User[];
export const products = productsJson as Product[];
export const orders = ordersJson as Order[];
export const reviews = reviewsJson as Review[];
export const chats = chatsJson as Chat[];
export const notifications = notificationsJson as Notification[];
export const locations = locationsJson as Location[];
