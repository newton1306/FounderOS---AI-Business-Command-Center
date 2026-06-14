import { useMemo, useState } from "react";
import { Bot, Search, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { chats } from "../data/source";
import { detectChatTopic, productById, productReviews, userById } from "../lib/analytics";
import { getReply, getReviewPainSummary } from "../lib/aiClient";
import type { ActionBrief, AiMode } from "../lib/types";
import { dateTime } from "../lib/format";

export function CustomerVoicePage(ctx: AppContext) {
  const reviews = useMemo(() => productReviews(), []);
  const avg = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const negative = reviews.filter((review) => review.rating <= 2);
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
        <button className="button primary ai-action" type="button" onClick={summarize}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>Summarize Customer Pain Points</button>
      </div>
      <div className="kpi-grid compact">
        <Metric label="Average Rating" value={avg.toFixed(1)} />
        <Metric label="Negative Reviews" value={String(negative.length)} />
        <Metric label="Open Chats" value={String(chats.filter((chat) => chat.status === "OPEN").length)} />
      </div>
      {summary && <section className="decision-panel ai-surface"><span className="ai-corner-star" aria-label="AI powered"><Star size={15} aria-hidden="true" /></span>{summaryMode === "fallback" && <FallbackNotice />}<p className="summary">{summary.summary}</p><div className="action-list">{summary.actions.map((action) => <article className="action-item" key={action.title}><strong>{action.title}</strong><span>{action.reason}</span><em>{action.impact}</em></article>)}</div></section>}
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
            {chats.slice().sort((a, b) => a.status.localeCompare(b.status)).map((chat) => {
              const customer = userById(chat.user_id);
              const latest = chat.messages[chat.messages.length - 1];
              const topic = detectChatTopic(chat.messages.map((message) => message.text).join(" "));
              return <article className={`chat-card ${chat.status === "OPEN" ? "open" : ""}`} key={chat.chat_id}>
                <div className="chat-head"><strong>{customer?.name || "Customer"}</strong><span className="badge watch">{customer?.role || "MEMBER"} - {chat.status}</span></div>
                <span>{topic}</span>
                <p>{latest?.text}</p>
                <time>{dateTime(latest?.timestamp || new Date().toISOString())}</time>
                <button className="button secondary ai-action" type="button" onClick={() => generateReply(chat.chat_id)}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>Generate Reply</button>
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
  return <p className="fallback-result-label">ผลลัพธ์นี้มาจาก fallback</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="kpi-card"><span>{label}</span><strong>{value}</strong></article>;
}
