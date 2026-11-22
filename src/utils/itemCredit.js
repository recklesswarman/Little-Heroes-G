import { escapeHtml } from './escapeHtml.js';

/** One small credit line for an item (Poly Pizza, game-icons, OpenMoji, ...). Empty when none is needed. */
export function renderItemCredit(item) {
  const c = item && item.credit;
  if (!c) return '';
  const text = typeof c === 'string' ? c : [c.title, c.author && `by ${c.author}`, c.license].filter(Boolean).join(', ');
  return text ? `<p class="text-[10px] text-on-surface-variant opacity-80">${escapeHtml(text)}</p>` : '';
}
