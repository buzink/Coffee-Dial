// Opens a table row's card: one click on desktop, double click on mobile widths.
const MOBILE_QUERY = '(max-width: 767px)';
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, summary, [contenteditable], [data-action-click], [data-action-change], .action-menu';

const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

const isPlainRowClick = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (event.target?.closest?.(INTERACTIVE_SELECTOR)) return false;
    return !(window.getSelection?.().toString().length > 0);
};

export const bindRowOpen = (row, open) => {
    row.classList.add('cursor-pointer');
    row.addEventListener('click', (event) => {
        if (!isMobileViewport() && isPlainRowClick(event)) open(event);
    });
    row.addEventListener('dblclick', (event) => {
        if (isMobileViewport()) open(event);
    });
};
