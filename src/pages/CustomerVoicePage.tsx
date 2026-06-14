import { useMemo, useState } from "react";
import { Bot, Search, Star } from "lucide-react";
import type { AppContext } from "../app/App";
import { chats } from "../data/source";
import { detectChatTopic, productById, productReviews, userById } from "../lib/analytics";
import { getReply, getReviewPainSummary } from "../lib/aiClient";
import type { Chat, ChatMessage } from "../lib/types";
import { dateTime } from "../lib/format";

export function CustomerVoicePage(ctx: AppContext) {
  const reviews = useMemo(() => productReviews(), []);
  const chatGroups = useMemo(() => groupDuplicateChats(chats), []);
  const avg = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const negative = reviews.filter((review) => review.rating <= 2);
  const uniqueChatCustomers = new Set(chats.map((chat) => chat.user_id)).size;
  const summary = ctx.voiceSummary?.data || null;
  const summaryMode = ctx.voiceSummary?.mode || null;
  const [mobileTab, setMobileTab] = useState<"ai" | "reviews" | "chats">("ai");

  async function summarize() {
    ctx.setVoiceSummaryLoading(true);
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getReviewPainSummary(ctx.state);
      ctx.setVoiceSummary({ data: result.data, mode: result.mode });
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
    } finally {
      ctx.setVoiceSummaryLoading(false);
    }
  }

  async function generateReply(chatId: string) {
    const chat = chats.find((item) => item.chat_id === chatId);
    if (!chat) return;
    ctx.setChatReplyLoading((current) => ({ ...current, [chatId]: true }));
    ctx.setAiMode("live");
    ctx.setAiReason("Checking Gemini API...");
    try {
      const result = await getReply(chat);
      ctx.setChatReplies((current) => ({ ...current, [chatId]: { text: result.data, mode: result.mode } }));
      ctx.setAiMode(result.mode);
      ctx.setAiReason(result.reason);
    } finally {
      ctx.setChatReplyLoading((current) => ({ ...current, [chatId]: false }));
    }
  }

  return (
    <section className="page-stack voice-page voice-page-v2">
      <div className="kpi-grid compact">
        <Metric label="Average Rating" value={avg.toFixed(1)} />
        <Metric label="Negative Reviews" value={String(negative.length)} />
        <Metric label="Needs Reply" value={String(chatGroups.filter((group) => chatNeedsReply(group.chat)).length)} />
        <Metric label="Chat Customers" value={String(uniqueChatCustomers)} />
      </div>

      {/* Mobile tab selector for 3-column view */}
      <div className="mobile-segment mobile-segment-3" aria-label="Customer voice sections">
        <button className={mobileTab === "ai" ? "active" : ""} type="button" onClick={() => setMobileTab("ai")}>AI Summary</button>
        <button className={mobileTab === "reviews" ? "active" : ""} type="button" onClick={() => setMobileTab("reviews")}>Reviews</button>
        <button className={mobileTab === "chats" ? "active" : ""} type="button" onClick={() => setMobileTab("chats")}>Chats</button>
      </div>

      {/* 3-column horizontal layout: AI Summary | Reviews | Chats */}
      <div className="voice-three-col">
        {/* AI Summary — always visible, prominent */}
        <section className="panel voice-ai-panel" data-mobile-panel={mobileTab === "ai" ? "active" : "hidden"}>
          <div className="voice-ai-header">
            <span className="ai-corner-star" aria-label="Gemini powered"><Star size={15} aria-hidden="true" /></span>
            <h3>AI Pain Analysis</h3>
            {summary && <button className="button secondary ai-action voice-ai-btn" type="button" onClick={summarize} disabled={ctx.voiceSummaryLoading}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>{ctx.voiceSummaryLoading ? "Analyzing..." : "Refresh"}</button>}
          </div>
          {!summary ? (
            <div className="voice-ai-empty">
              <Bot size={28} />
              <p>Analyze pain points from reviews and customer chats with Gemini</p>
              <div className="gemini-cta-center">
                <button className="button primary ai-action gemini-cta-pulse" type="button" onClick={summarize} disabled={ctx.voiceSummaryLoading}>
                  <span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>{ctx.voiceSummaryLoading ? "Analyzing..." : "Analyze"}
                </button>
                <span className="cta-hand" aria-hidden="true">👆</span>
              </div>
            </div>
          ) : (
            <div className="voice-ai-content">
              {summaryMode === "fallback" && <FallbackNotice />}
              <p className="summary">{summary.summary}</p>
              <div className="action-list">
                {summary.actions.map((action) => (
                  <article className="action-item" key={action.title}>
                    <strong>{action.title}</strong>
                    <span>{action.reason}</span>
                    <em>{action.impact}</em>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Product Reviews */}
        <section className="panel" data-mobile-panel={mobileTab === "reviews" ? "active" : "hidden"}>
          <h3>Product Reviews</h3>
          <div className="list">
            {reviews.length ? reviews.map((review) => {
              const product = productById(ctx.state.products, review.target_id);
              return <article className="list-item" key={review.review_id}><strong>{product?.name || review.target_id}</strong><span className="rating-line">{userById(review.user_id)?.name || "Customer"} - <Star className="rating-star" size={13} aria-hidden="true" />{review.rating}/5 - <b>{review.rating <= 2 ? "Negative" : review.rating >= 4 ? "Positive" : "Neutral"}</b></span><em>{review.comment}</em>{review.rating <= 2 && <span className="badge low">Action needed</span>}</article>;
            }) : <div className="empty-state"><Search size={20} />No reviews available.</div>}
          </div>
        </section>

        {/* Chat Inbox */}
        <section className="panel" data-mobile-panel={mobileTab === "chats" ? "active" : "hidden"}>
          <h3>Chat Inbox</h3>
          <div className="list">
            {chatGroups.map((group) => {
              const chat = group.chat;
              const customer = userById(chat.user_id);
              const latest = chat.messages[chat.messages.length - 1];
              const topic = detectChatTopic(chat.messages.map((message) => message.text).join(" "));
              const state = getChatState(chat);
              const canGenerateReply = chatNeedsReply(chat);
              return <article className={`chat-card ${chat.status === "OPEN" ? "open" : ""} ${state.tone}`} key={chat.chat_id}>
                <div className="chat-head"><strong>{customer?.name || "Customer"}</strong><span className="badge watch">{customer?.role || "MEMBER"} - {chat.status}</span></div>
                <div className="chat-meta-row">
                  <span>{topic}</span>
                  <span className={`chat-state-chip ${state.tone}`}>{state.label}</span>
                </div>
                <ChatThreadPreview chat={chat} customerName={customer?.name} />
                {group.duplicates.length > 1 && <span className="duplicate-note">Grouped {group.duplicates.length} chats from this customer: {group.duplicates.map((item) => item.chat_id).join(", ")}</span>}
                <time>Last activity {dateTime(latest?.timestamp || new Date().toISOString())}</time>
                {canGenerateReply ? <button className="button secondary ai-action" type="button" onClick={() => generateReply(chat.chat_id)} disabled={Boolean(ctx.chatReplyLoading[chat.chat_id])}><span className="ai-icon-pair"><Star size={13} /><Bot size={15} /></span>{ctx.chatReplyLoading[chat.chat_id] ? "Gemini is thinking..." : "Gemini Reply"}</button> : <span className="chat-action-note">{state.note}</span>}
                {ctx.chatReplies[chat.chat_id] && <div className="reply-box">{ctx.chatReplies[chat.chat_id].mode === "fallback" && <FallbackNotice />}{ctx.chatReplies[chat.chat_id].text}</div>}
              </article>;
            })}
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

function ChatThreadPreview({ chat, customerName }: { chat: Chat; customerName?: string }) {
  return (
    <div className="chat-thread-preview">
      {chat.messages.slice(-4).map((message, index) => (
        <div className={`thread-message ${message.sender === "USER" ? "customer" : "shop"}`} key={`${message.timestamp}-${index}`}>
          <span>{speakerLabel(message, customerName)}</span>
          <p>{message.text}</p>
        </div>
      ))}
    </div>
  );
}

function speakerLabel(message: ChatMessage, customerName?: string) {
  return message.sender === "USER" ? customerName || "Customer" : "Shop";
}

function chatNeedsReply(chat: Chat) {
  return chat.status === "OPEN" && chat.messages.at(-1)?.sender === "USER";
}

function getChatState(chat: Chat) {
  if (chat.status === "CLOSED") {
    return { label: "Closed", note: "No reply needed - this conversation is closed.", tone: "closed" };
  }
  if (chatNeedsReply(chat)) {
    return { label: "Needs reply", note: "Gemini can draft the next shop reply.", tone: "needs-reply" };
  }
  return { label: "Answered by shop", note: "No reply needed - the shop already answered.", tone: "answered" };
}

function groupDuplicateChats(items: Chat[]) {
  const groups = new Map<string, Chat[]>();
  for (const chat of items) {
    groups.set(chat.user_id, [...(groups.get(chat.user_id) || []), chat]);
  }

  return Array.from(groups.values())
    .map((duplicates) => {
      const sorted = [...duplicates].sort(compareChats);
      return { chat: sorted[0], duplicates: sorted };
    })
    .sort((a, b) => compareChats(a.chat, b.chat));
}

function compareChats(a: Chat, b: Chat) {
  const aNeedsReply = chatNeedsReply(a);
  const bNeedsReply = chatNeedsReply(b);
  if (aNeedsReply !== bNeedsReply) return aNeedsReply ? -1 : 1;
  if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
  const aLatest = a.messages.at(-1)?.timestamp || "";
  const bLatest = b.messages.at(-1)?.timestamp || "";
  return bLatest.localeCompare(aLatest);
}
