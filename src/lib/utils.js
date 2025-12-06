// Shared utility functions used across components

export const isExternalUrl = (url) => /^(https?:)?\/\//i.test(url || '');

export const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Renders text with Bluesky facets (links) into HTML. Consumers should insert with {@html ...}
export const renderTextWithLinks = (text, facets) => {
  if (!text) return '';
  if (!facets || facets.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);

  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  let result = '';
  let lastIndex = 0;

  for (const facet of sortedFacets) {
    const { byteStart, byteEnd } = facet.index;

    if (byteStart > lastIndex) {
      const beforeBytes = bytes.slice(lastIndex, byteStart);
      const beforeText = decoder.decode(beforeBytes);
      result += escapeHtml(beforeText);
    }

    const facetBytes = bytes.slice(byteStart, byteEnd);
    const facetText = decoder.decode(facetBytes);

    const linkFeature = facet.features?.find((f) => f.$type === 'app.bsky.richtext.facet#link');
    const mentionFeature = facet.features?.find((f) => f.$type === 'app.bsky.richtext.facet#mention');

    if (linkFeature && linkFeature.uri && isExternalUrl(linkFeature.uri)) {
      result += `<a href="${escapeHtml(linkFeature.uri)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${escapeHtml(
        facetText,
      )}</a>`;
    } else if (mentionFeature && mentionFeature.did) {
      // Render mention as a clickable span with data attribute
      result += `<span class="text-blue-400 hover:underline cursor-pointer" data-mention-did="${escapeHtml(mentionFeature.did)}" role="button" tabindex="0">${escapeHtml(
        facetText,
      )}</span>`;
    } else {
      result += escapeHtml(facetText);
    }

    lastIndex = byteEnd;
  }

  if (lastIndex < bytes.length) {
    const afterBytes = bytes.slice(lastIndex);
    const afterText = decoder.decode(afterBytes);
    result += escapeHtml(afterText);
  }

  return result.replace(/\n/g, '<br>');
};

export const formatPostDate = (dateString) => {
  const postDate = new Date(dateString);
  const now = new Date();
  const diffInMs = now - postDate;
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else if (diffInDays <= 31) {
    return `${diffInDays}d`;
  } else {
    const month = postDate.getMonth() + 1;
    const day = postDate.getDate();
    const year = postDate.getFullYear();
    return `${month}/${day}/${year}`;
  }
};

export async function toggleLike(agent, post, updateStateCallback) {
  if (!agent || !post) return;

  const isLiked = !!post.viewer?.like;
  const uri = post.uri;
  const cid = post.cid;

  // Optimistic update
  const optimisticLikeCount = (post.likeCount || 0) + (isLiked ? -1 : 1);
  const optimisticViewer = { ...post.viewer, like: isLiked ? undefined : 'pending' };

  updateStateCallback(uri, {
    likeCount: optimisticLikeCount < 0 ? 0 : optimisticLikeCount,
    viewer: optimisticViewer,
  });

  try {
    if (isLiked) {
      await agent.deleteLike(post.viewer.like);
      // Final update (success) - confirm removal
      updateStateCallback(uri, {
        viewer: { ...post.viewer, like: undefined },
      });
    } else {
      const response = await agent.like(uri, cid);
      // Final update (success) - confirm addition with new URI
      updateStateCallback(uri, {
        viewer: { ...post.viewer, like: response.uri },
      });
    }
  } catch (error) {
    console.error('Like/unlike error:', error);
    throw error;
  }
}

// Flatten the recursive thread structure into a linear array for display
export function flattenThread(thread) {
  let posts = [];

  // Add parents (recursively)
  if (thread.parent) {
    posts = [...flattenThread(thread.parent)];
  }

  // Add current post
  if (thread.post) {
    // Convert to the format FeedPost expects (similar to timeline item)
    posts.push({
      post: thread.post,
      // We don't always have reason/reply context in the thread view the same way,
      // but we construct a basic item
      reply: thread.parent ? { parent: thread.parent.post } : undefined,
    });
  }

  // Add replies (we generally just want the linear conversation,
  // but if there are multiple replies, we might just show the main chain or immediate replies)
  // For this view, let's strictly show the chain leading to the selected post
  // and maybe immediate replies if the selected post is the parent.
  // However, the requirement is "view all posts in the thread".
  // A linear conversation usually implies following the replies of the author.

  if (thread.replies && thread.replies.length > 0) {
    // Sort by time
    const sortedReplies = thread.replies.slice((a, b) => new Date(a.post.record.createdAt) - new Date(b.post.record.createdAt));

    // We add all replies to the flattened list
    for (const reply of sortedReplies) {
      // Filter out replies not by the original author
      if (reply.post.author.did !== thread.post.author.did) continue;

      // We only recurse if it's part of the same conversation "thread" visually
      // For simplicity in this view, let's flatten one level deep or
      // checking if it's the same author to keep the "Thread" feel
      posts.push({
        post: reply.post,
        reply: { parent: thread.post },
      });

      // If we wanted deep recursion for replies-to-replies:
      // posts = [...posts, ...flattenReplies(reply)];
    }
  }

  return posts;
}

export function processFeed(posts) {
  const items = [];
  let i = 0;

  while (i < posts.length) {
    const current = posts[i];
    const thread = [current];
    let j = i + 1;

    while (j < posts.length) {
      const next = posts[j];
      const prevInGroup = thread[thread.length - 1];

      const sameAuthor = prevInGroup.post.author.did === next.post.author.did;
      const isReplyToNext = prevInGroup.reply?.parent?.uri === next.post.uri;

      if (sameAuthor && isReplyToNext) {
        thread.push(next);
        j++;
      } else {
        break;
      }
    }

    if (thread.length > 1) {
      items.push({ type: 'threadGroup', items: thread });
      i = j;
    } else {
      items.push({ type: 'post', item: current });
      i++;
    }
  }
  return items;
}
