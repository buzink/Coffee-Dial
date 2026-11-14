// Main sections (beans, coffees, gear, statistics) render as pages inside <main>
// instead of overlays. Each page element carries `data-app-page="<route key>"` and
// is still shown/hidden by its feature with the `hidden` class. This module keeps
// at most one page visible: when one is shown, the others are hidden and the view
// scrolls to the top. With no page visible, the brews view shows (see app.css).

export const PAGE_ROUTE_KEYS = ['beans', 'coffees', 'gear', 'statistics'];

const isVisible = (el) => !!el && !el.classList.contains('hidden');

const getPageElements = (root = document) => Array.from(root.querySelectorAll('[data-app-page]'));

export const getVisiblePageKey = (root = document) => {
    const visible = getPageElements(root).find(isVisible);
    return visible ? visible.getAttribute('data-app-page') : '';
};

export const initPages = ({ root = document.querySelector('main'), onPageChange = null } = {}) => {
    if (!root || typeof MutationObserver === 'undefined') return () => {};

    const visibleState = new Map(getPageElements(root).map((el) => [el, isVisible(el)]));

    const observer = new MutationObserver((mutations) => {
        let shown = null;
        let changed = false;
        mutations.forEach((mutation) => {
            const el = mutation.target;
            if (!(el instanceof Element) || !el.hasAttribute('data-app-page')) return;
            const now = isVisible(el);
            if (visibleState.get(el) === now) return;
            visibleState.set(el, now);
            changed = true;
            if (now) shown = el;
        });
        // Pages can be mounted later (statistics is lazy), so pick those up too.
        getPageElements(root).forEach((el) => {
            if (visibleState.has(el)) return;
            visibleState.set(el, isVisible(el));
            if (isVisible(el)) {
                shown = el;
                changed = true;
            }
        });
        if (!changed) return;
        if (shown) {
            getPageElements(root).forEach((el) => {
                if (el === shown || !isVisible(el)) return;
                el.classList.add('hidden');
                visibleState.set(el, false);
            });
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        if (typeof onPageChange === 'function') onPageChange(getVisiblePageKey(root));
    });

    observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    return () => observer.disconnect();
};
