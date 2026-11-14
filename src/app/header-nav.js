// The main sections in the header. When the header is too narrow, items that do
// not fit are hidden from the end; the item of the current page stays visible.
// All sections remain in the menu.

export const initHeaderNav = ({ getCurrentPageKey }) => {
    const nav = document.getElementById('headerNav');
    if (!nav) return () => {};
    const items = Array.from(nav.querySelectorAll('[data-nav-page]'));

    const fit = () => {
        items.forEach((item) => item.removeAttribute('data-nav-overflow'));
        if (nav.classList.contains('hidden') || nav.clientWidth === 0) return;
        const current = getCurrentPageKey();
        for (let i = items.length - 1; i >= 0 && nav.scrollWidth > nav.clientWidth; i -= 1) {
            if (items[i].getAttribute('data-nav-page') === current) continue;
            items[i].setAttribute('data-nav-overflow', '');
        }
    };

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => fit()).observe(nav);
    } else {
        window.addEventListener('resize', fit);
    }
    document.fonts?.ready?.then(fit).catch(() => {});
    fit();
    return fit;
};
