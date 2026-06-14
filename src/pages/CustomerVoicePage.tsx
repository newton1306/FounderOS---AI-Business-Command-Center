import { useMemo, useState } from "react";
import { Bot, Search, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { chats } from "../data/source";
import { detectChatTopic, productById, productReviews, userById } from "../lib/analytics";
import { getReply, getReviewPainSummary } from "../lib/aiClient";
import type { ActionBrief, AiMode, Chat } from "../lib/types";
import { dateTime } from "../lib/format";

export function CustomerVoicePage(ctx: AppContext) {
  const reviews = useMemo(() => productReviews(), []);
  const chatGroups = useMemo(() => groupDuplicateChats(chats), []);
  const avg = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const negative = reviews.filter((review) => review.rating <= 2);
  const hiddenDuplicateChats = chats.length - chatGroups.length;
  const [summary, setSummary] = useState<ActionBrief | null>(null);
  const [summaryMode, setSummaryMode] = useState<AiMode | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [replyMode, setReplyMode] = useState<Record<string, AiMode>>({});
  const [mobileTab, setMobileTab] = useState<"reviews" | "chats">("reviews");

  async function summarize() {
    const result = await getReviewPainSummary(ctx.state);
    setSummary(result.data);
    setSummaryMode(result.mode);
    ctx.setAiMode(result.mode);
    ctx.setAiReason(result.reason);
  }

  async function generateReply(chatId: string) {
    const chat = chats.find((item) => item.chat_id === chatId);
    if (!chat) return;
    const result = await getReply(chat);
    setReply((current) => ({ ...current, [chatId]: result.data }));
    setReplyMode((current) => ({ ...current, [chatId]: result.mode }));
    ctx.setAiMode(result.mode);
    ctx.setAiReason(result.reason);
  }

  return (
    <section className={`page-stack voice-page ${summary ? "has-ai-summary" : ""}`}>
      <div className="section-head page-actions-head">
        <button className="button primary ai-action" type="button" onClick={summarize}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>Gemini Pain Summary</button>
      </div>
      <div className="kpi-grid compact">
        <Metric label="Average Rating" value={avg.toFixed(1)} />
        <Metric label="Negative Reviews" value={String(negative.length)} />
        <Metric label="Open Chats" value={String(chatGroups.filter((group) => group.chat.status === "OPEN").length)} />
        <Metric label="Merged Duplicates" value={String(hiddenDuplicateChats)} />
      </div>
      {summary && <section className="decision-panel ai-surface"><span className="ai-corner-star" aria-label="Gemini powered"><Star size={15} aria-hidden="true" /></span>{summaryMode === "fallback" && <FallbackNotice />}<p className="summary">{summary.summary}</p><div className="action-list">{summary.actions.map((action) => <article className="action-item" key={action.title}><strong>{action.title}</strong><span>{action.reason}</span><em>{action.impact}</em></article>)}</div></section>}
      <div className="mobile-segment" aria-label="Customer voice sections">
        <button className={mobileTab === "reviews" ? "active" : ""} type="button" onClick={() => setMobileTab("reviews")}>Reviews</button>
        <button className={mobileTab === "chats" ? "active" : ""} type="button" onClick={() => setMobileTab("chats")}>Chats</button>
      </div>
      <div className="two-column">
        <section className="panel" data-mobile-panel={mobileTab === "reviews" ? "active" : "hidden"}>
          <h3>Product Reviews</h3>
          <div className="list">
            {reviews.length ? reviews.map((review) => {
              const product = productById(ctx.state.products, review.target_id);
              return <article className="list-item" key={review.review_id}><strong>{product?.name || review.target_id}</strong><span className="rating-line">{userById(review.user_id)?.name || "Customer"} - <Star className="rating-star" size={13} aria-hidden="true" />{review.rating}/5 - <b>{review.rating <= 2 ? "Negative" : review.rating >= 4 ? "Positive" : "Neutral"}</b></span><em>{review.comment}</em>{review.rating <= 2 && <span className="badge low">Action needed</span>}</article>;
            }) : <div className="empty-state"><Search size={20} />No reviews available.</div>}
          </div>
        </section>
        <section className="panel" data-mobile-panel={mobileTab === "chats" ? "active" : "hidden"}>
          <h3>Chat Inbox</h3>
          <div className="list">
            {chatGroups.map((group) => {
              const chat = group.chat;
              const customer = userById(chat.user_id);
              const latest = chat.messages[chat.messages.length - 1];
              const latestCustomerMessage = [...chat.messages].reverse().find((message) => message.sender === "USER");
              const latestShopMessage = [...chat.messages].reverse().find((message) => message.sender === "SHOP");
              const topic = detectChatTopic(chat.messages.map((message) => message.text).join(" "));
              return <article className={`chat-card ${chat.status === "OPEN" ? "open" : ""}`} key={chat.chat_id}>
                <div className="chat-head"><strong>{customer?.name || "Customer"}</strong><span className="badge watch">{customer?.role || "MEMBER"} - {chat.status}</span></div>
                <div className="chat-meta-row">
                  <span>{topic}</span>
                  <span className={`sender-chip ${latest?.sender === "USER" ? "customer" : "shop"}`}>{latest?.sender === "USER" ? "Last: Customer" : "Last: Shop"}</span>
                </div>
                <p><strong className="message-label">Customer:</strong> {latestCustomerMessage?.text || latest?.text}</p>
                {latest?.sender === "SHOP" && latestShopMessage && <em className="shop-preview">Shop replied: {latestShopMessage.text}</em>}
                {group.duplicates.length > 1 && <span className="duplicate-note">Merged {group.duplicates.length} similar records: {group.duplicates.map((item) => item.chat_id).join(", ")}</span>}
                <time>{dateTime((latestCustomerMessage || latest)?.timestamp || new Date().toISOString())}</time>
                <button className="button secondary ai-action" type="button" onClick={() => generateReply(chat.chat_id)}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>Gemini Reply</button>
                {reply[chat.chat_id] && <div className="reply-box">{replyMode[chat.chat_id] === "fallback" && <FallbackNotice />}{reply[chat.chat_id]}</div>}
              </article>;
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function FallbackNotice() {
  return <p className="fallback-result-label">{"\u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e19\u0e35\u0e49\u0e21\u0e32\u0e08\u0e32\u0e01 fallback"}</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="kpi-card"><span>{label}</span><strong>{value}</strong></article>;
}

function groupDuplicateChats(items: Chat[]) {
  const groups = new Map<string, Chat[]>();
  for (const chat of items) {
    const signature = [
      chat.user_id,
      ...chat.messages.map((message) => `${message.sender}:${message.text}`)
    ].join("|");
    groups.set(signature, [...(groups.get(signature) || []), chat]);
  }

  return Array.from(groups.values())
    .map((duplicates) => {
      const chat = duplicates.find((item) => item.status === "OPEN") || duplicates[0];
      return { chat, duplicates };
    })
    .sort((a, b) => {
      if (a.chat.status !== b.chat.status) return a.chat.status === "OPEN" ? -1 : 1;
      const aLatest = a.chat.messages.at(-1)?.timestamp || "";
      const bLatest = b.chat.messages.at(-1)?.timestamp || "";
      return bLatest.localeCompare(aLatest);
    });
}
