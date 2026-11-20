export function paginate(items, requestedPage = 1, pageSize = 20) {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 20;
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const requested = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(pageCount, Math.max(1, requested));
  const start = total ? (page - 1) * size : 0;
  const end = total ? Math.min(start + size, total) : 0;
  return { items: items.slice(start, end), page, pageCount, start, end, total };
}

export function pageTokens(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', pageCount];
  if (page >= pageCount - 3) return [1, 'ellipsis', ...Array.from({ length: 5 }, (_, index) => pageCount - 4 + index)];
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount];
}
