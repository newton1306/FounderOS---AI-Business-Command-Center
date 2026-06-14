import { chats } from "../data/source";
import { detectChatTopic, getMetrics, getProductInsights, orderRisk, productById, productReviews, userById } from "./analytics";
import type { ActionBrief, BusinessState, Chat, Order, Product } from "./types";

export function founderBriefFallback(state: BusinessState): ActionBrief {
  const metrics = getMetrics(state);
  const insights = getProductInsights(state);
  const lowStock = insights.filter((item) => item.stockStatus === "low" || item.stockStatus === "out").sort((a, b) => b.revenue - a.revenue);
  const weakReviews = insights.filter((item) => item.negativeReviews > 0).sort((a, b) => b.negativeReviews - a.negativeReviews);
  const pendingOrders = state.orders.filter((order) => order.status === "PENDING");
  const openChats = chats.filter((chat) => chat.status === "OPEN");
  const topCategory = insights.reduce<Record<string, number>>((acc, item) => {
    acc[item.product.category] = (acc[item.product.category] || 0) + item.revenue;
    return acc;
  }, {});
  const bestCategory = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "Electronics";

  return {
    summary: `Local analysis found ${metrics.lowStock} stock risks, ${pendingOrders.length} pending orders, ${openChats.length} open chats, and ${metrics.negativeReviews} negative product reviews.`,
    actions: [
      {
        title: lowStock[0] ? `Restock ${lowStock[0].product.name}` : `Protect ${bestCategory} momentum`,
        reason: lowStock[0] ? `Stock is ${lowStock[0].product.stock} units while this product already sold ${lowStock[0].unitsSold} units.` : `${bestCategory} is the strongest revenue category in the current orders.`,
        impact: lowStock[0] ? "Avoid missed revenue and urgent customer support caused by stockouts." : "Push budget toward the category already converting.",
        source: "local-fallback"
      },
      {
        title: pendingOrders.length ? "Follow up pending orders today" : "Turn delivered buyers into repeat orders",
        reason: pendingOrders.length ? `${pendingOrders.length} orders are still PENDING and can slip into cancellation.` : "Delivered/paid orders dominate the dataset, so retention is the next lever.",
        impact: pendingOrders.length ? "Recover near-term revenue and reduce operational uncertainty." : "Improve repeat purchase rate without adding acquisition cost.",
        source: "local-fallback"
      },
      {
        title: weakReviews[0] ? `Resolve review pain on ${weakReviews[0].product.name}` : "Clear high-priority open chats",
        reason: weakReviews[0] ? `${weakReviews[0].negativeReviews} negative review signal(s) are attached to this product.` : `${openChats.length} customer conversations are still open, including VIP customers if present.`,
        impact: weakReviews[0] ? "Protect conversion before review issues compound." : "Reduce support backlog and protect customer trust.",
        source: "local-fallback"
      }
    ]
  };
}

export function productInsightFallback(product: Product, state: BusinessState): ActionBrief {
  const insight = getProductInsights(state).find((item) => item.product.product_id === product.product_id);
  const relatedOrders = state.orders.filter((order) => order.items.some((item) => item.product_id === product.product_id));
  return {
    summary: `${product.name} has ${product.stock} units left, ${insight?.unitsSold || 0} units sold, and ${insight?.averageRating ? insight.averageRating.toFixed(1) : "no"} average rating signal.`,
    actions: [
      {
        title: product.stock <= 5 ? "Create urgent restock task" : "Monitor stock against demand",
        reason: product.stock <= 5 ? `Only ${product.stock} units remain.` : `Current stock is ${product.stock} units across ${relatedOrders.length} related orders.`,
        impact: product.stock <= 5 ? "Prevents stockout during live demo and real operations." : "Keeps purchasing grounded in actual order velocity.",
        source: "local-fallback"
      },
      {
        title: (insight?.negativeReviews || 0) > 0 ? "Fix review objection" : "Use positive proof in product copy",
        reason: (insight?.negativeReviews || 0) > 0 ? `${insight?.negativeReviews} low-rating review(s) are attached.` : "No severe review issue is visible for this product.",
        impact: "Improves conversion quality and reduces support friction.",
        source: "local-fallback"
      },
      {
        title: "Bundle with adjacent best sellers",
        reason: `The product sits in ${product.category}, which can be merchandised with nearby category demand.`,
        impact: "Raises average order value without requiring new inventory data.",
        source: "local-fallback"
      }
    ]
  };
}

export function reviewPainFallback(state: BusinessState): ActionBrief {
  const negative = productReviews().filter((review) => review.rating <= 2);
  const samples = negative.slice(0, 3).map((review) => `"${review.comment}"`).join(", ");
  return {
    summary: negative.length ? `Negative product review themes from real data: ${samples}` : "No severe product review cluster is present in the dataset.",
    actions: [
      {
        title: "Reply to low-rating product reviews first",
        reason: `${negative.length} product review(s) are rated 1-2 stars.`,
        impact: "Shows active service recovery and protects conversion.",
        source: "local-fallback"
      },
      {
        title: "Tag issues by product before campaign spend",
        reason: "Review comments are attached to product IDs, so issues can be routed to merchandising.",
        impact: "Prevents pushing traffic to products with unresolved objections.",
        source: "local-fallback"
      },
      {
        title: "Use support answers as product-page FAQ",
        reason: "Chats already reveal warranty, delivery, damaged package, and availability questions.",
        impact: "Reduces repeated support load.",
        source: "local-fallback"
      }
    ]
  };
}

export function replyFallback(chat: Chat) {
  const customer = userById(chat.user_id);
  const latestUserMessage = [...chat.messages].reverse().find((message) => message.sender === "USER")?.text || "";
  const topic = detectChatTopic(latestUserMessage);
  if (topic === "Warranty") return `สวัสดีครับคุณ${customer?.name || "ลูกค้า"} ขอบคุณที่สอบถามครับ สินค้ามีการรับประกันตามเงื่อนไขร้านค้า หากต้องการเคลมหรือส่งซ่อม รบกวนส่งเลขคำสั่งซื้อและรูปอาการเพิ่มเติมได้เลยครับ ทีมงานจะช่วยตรวจสอบให้ทันทีครับ`;
  if (topic === "Damaged Package") return `สวัสดีครับคุณ${customer?.name || "ลูกค้า"} ต้องขออภัยเรื่องพัสดุครับ รบกวนถ่ายรูปกล่องและตัวสินค้าไว้ก่อนแกะใช้งาน หากสินค้ามีความเสียหาย เราจะช่วยดำเนินการเคลมหรือเปลี่ยนสินค้าให้เร็วที่สุดครับ`;
  if (topic === "Shipping Status") return `สวัสดีครับคุณ${customer?.name || "ลูกค้า"} เดี๋ยวทีมงานตรวจสอบสถานะจัดส่งให้ครับ รบกวนแจ้งเลขคำสั่งซื้ออีกครั้ง หากมีเลขพัสดุแล้วเราจะส่งให้ทันทีครับ`;
  return `สวัสดีครับคุณ${customer?.name || "ลูกค้า"} ขอบคุณที่ติดต่อมาครับ เดี๋ยวทีมงานตรวจสอบรายละเอียดและตอบกลับพร้อมทางเลือกที่เหมาะสมที่สุดให้ครับ`;
}

export function orderSummaryFallback(order: Order, state: BusinessState) {
  const user = userById(order.user_id);
  const items = order.items.map((item) => `${productById(state.products, item.product_id)?.name || item.product_id} x${item.qty}`).join(", ");
  return `${order.order_id} is a ${order.status} order for ${user?.name || "Unknown customer"} (${user?.role || "MEMBER"}) worth ${order.total_price.toLocaleString("th-TH")} THB. Items: ${items}. Risk: ${orderRisk(order, state.products)}.`;
}

export function chatbotFallback(question: string, state: BusinessState): string {
  const q = question.toLowerCase();
  const allReviews = productReviews();

  // Find mentioned product
  const matchedProduct = state.products.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.product_id.toLowerCase()));

  // Stock query
  if (/เหลือ|สต็อก|stock|คงเหลือ|เท่าไหร่|กี่ชิ้น|หมด|left|remaining|low/.test(q)) {
    if (matchedProduct) {
      const status = matchedProduct.stock <= 0 ? "❌ Out of stock" : matchedProduct.stock <= 5 ? "⚠️ Running low" : "✅ In stock";
      return `📦 **${matchedProduct.name}** — **${matchedProduct.stock} units** remaining (${status})`;
    }
    const lowStock = state.products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 5);
    if (lowStock.length) {
      return `📦 Low stock products:\n${lowStock.map((p) => `• ${p.name}: ${p.stock} units ${p.stock <= 0 ? "❌" : "⚠️"}`).join("\n")}`;
    }
    return "✅ All products have healthy stock levels.";
  }

  // Price query
  if (/ราคา|price|กี่บาท|เท่าไร|cost|how much/.test(q)) {
    if (matchedProduct) {
      return `💰 **${matchedProduct.name}** — Price: **฿${matchedProduct.price.toLocaleString("th-TH")}** | Category: ${matchedProduct.category} | Stock: ${matchedProduct.stock} units`;
    }
    return "Please specify a product name to check its price.";
  }

  // Best seller query
  if (/ขายดี|best.?seller|ยอดขาย|ขายได้|top|popular/.test(q)) {
    const insights = getProductInsights(state);
    const top5 = insights.sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    return `🏆 Top 5 Best Sellers:\n${top5.map((item, i) => `${i + 1}. ${item.product.name} — ${item.unitsSold} units sold (฿${item.revenue.toLocaleString("th-TH")})`).join("\n")}`;
  }

  // Revenue query
  if (/รายได้|revenue|ยอด|เงิน|กำไร|income|sales/.test(q)) {
    const metrics = getMetrics(state);
    return `💵 Total Revenue: **฿${metrics.revenue.toLocaleString("th-TH")}** from ${metrics.orders} orders\n• Pending orders: ${metrics.statusSummary.PENDING || 0}\n• Cancelled: ${metrics.statusSummary.CANCELLED || 0}`;
  }

  // Review query
  if (/รีวิว|review|คะแนน|rating|ดาว|feedback/.test(q)) {
    if (matchedProduct) {
      const reviews = allReviews.filter((r) => r.target_id === matchedProduct.product_id);
      if (!reviews.length) return `📝 **${matchedProduct.name}** has no reviews yet.`;
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      const neg = reviews.filter((r) => r.rating <= 2);
      return `📝 **${matchedProduct.name}** — Average rating: **${avg.toFixed(1)}/5** (${reviews.length} reviews)\n${neg.length ? `⚠️ ${neg.length} negative review(s): ${neg.slice(0, 2).map((r) => `"${r.comment}"`).join(", ")}` : "✅ No negative reviews"}`;
    }
    const metrics = getMetrics(state);
    return `📝 Review overview: Average **${metrics.avgRating.toFixed(1)}/5** | Negative reviews: ${metrics.negativeReviews}`;
  }

  // Order query
  if (/ออเดอร์|order|คำสั่งซื้อ|สถานะ|status/.test(q)) {
    const metrics = getMetrics(state);
    return `📋 Total orders: ${metrics.orders}\n• DELIVERED: ${metrics.statusSummary.DELIVERED || 0}\n• SHIPPED: ${metrics.statusSummary.SHIPPED || 0}\n• PAID: ${metrics.statusSummary.PAID || 0}\n• PENDING: ${metrics.statusSummary.PENDING || 0}\n• CANCELLED: ${metrics.statusSummary.CANCELLED || 0}`;
  }

  // Chat query
  if (/แชท|chat|ข้อความ|ลูกค้า|สอบถาม|customer|message/.test(q)) {
    const openChats = chats.filter((c) => c.status === "OPEN");
    return `💬 Open chats: **${openChats.length}**\n${openChats.slice(0, 3).map((c) => `• ${userById(c.user_id)?.name || c.user_id}: "${c.messages.at(-1)?.text || ""}"`).join("\n")}`;
  }

  // Product info (matched but no specific query type)
  if (matchedProduct) {
    const insight = getProductInsights(state).find((item) => item.product.product_id === matchedProduct.product_id);
    return `📌 **${matchedProduct.name}**\n• Price: ฿${matchedProduct.price.toLocaleString("th-TH")}\n• Stock: ${matchedProduct.stock} units\n• Units sold: ${insight?.unitsSold || 0}\n• Review rating: ${insight?.averageRating?.toFixed(1) || "N/A"}/5\n• Category: ${matchedProduct.category}`;
  }

  // General summary
  const metrics = getMetrics(state);
  return `📊 Store Summary:\n• Total revenue: ฿${metrics.revenue.toLocaleString("th-TH")}\n• Orders: ${metrics.orders}\n• Stock risks: ${metrics.lowStock} products\n• Open chats: ${metrics.openChats}\n• Review rating: ${metrics.avgRating.toFixed(1)}/5\n\nTry asking something specific, e.g. "How much stock does X have?" or "Best sellers"`;
}

