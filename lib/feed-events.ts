import type { FeedItem } from "@/lib/feed";

export const FEED_PREPEND_POST_EVENT = "feed:prepend-post";

export type FeedPrependPostDetail = {
  post: Extract<FeedItem, { kind: "post" }>;
};

export function dispatchFeedPrependPost(detail: FeedPrependPostDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEED_PREPEND_POST_EVENT, { detail }));
}
