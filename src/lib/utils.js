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
    if (linkFeature && linkFeature.uri) {
      result += `<a href="${escapeHtml(linkFeature.uri)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${escapeHtml(
        facetText,
      )}</a>`;
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
