// Cards (brew, bean, coffee, gear) are overlays that belong to a page. When a card
// opens on top of another page (say a coffee card from a brew card on the brews
// page), the app moves to the card's own page first, as a new history step, with
// the card on top. Each history entry remembers the card that is open in it
// (`history.state.appCard`), so Back and Forward reopen it.
// The back button at the top left of a card ([data-card-back]) goes back to where
// the card was opened from: the previous history step when opening the card made
// one (appCard.pushed), otherwise it just closes the card. The X at the top right
// ([data-card-close]) always just closes the card, staying on the page under it.

const RECENT_CLOSE_MS = 3000;

export const isEditingCard = (overlay) => !!overlay?.querySelector?.('.app-card-edit:not(.hidden)');

export const createCardRouting = ({
    cards,
    getCurrentPageKey,
    goToPage
}) => {
    const cardByOverlayId = new Map(cards.map((card) => [card.overlayId, card]));
    const cardByType = new Map(cards.map((card) => [card.type, card]));
    let isRestoring = false;
    let lastClosed = null;

    const isVisible = (el) => !!el && !el.classList.contains('hidden');
    const getStateCard = () => window.history.state?.appCard || null;
    const writeStateCard = (appCard) => {
        const state = { ...(window.history.state || {}) };
        if (appCard) state.appCard = appCard;
        else delete state.appCard;
        window.history.replaceState(state, document.title, window.location.href);
    };

    // Rewriting the card already in this entry keeps its `pushed` mark, so Back still
    // returns to where that card came from (e.g. brew → bag → coffee: the bag entry is
    // rewritten when the coffee opens, and must still lead back to the brew).
    const withPushedMark = (stateCard) => {
        const current = getStateCard();
        const same = current?.pushed && current.type === stateCard.type && current.id === stateCard.id;
        return same ? { ...stateCard, pushed: true } : stateCard;
    };

    const onCardShown = (card) => {
        const id = card.getId();
        if (!id) return;
        if (isRestoring || card.pageKey === getCurrentPageKey()) {
            writeStateCard(withPushedMark({ type: card.type, id }));
            return;
        }
        // The card opened on another page. Keep the card it was opened from (open,
        // or closed a moment ago by the cross-link) in the entry we leave.
        const openOther = cards.find((other) => other !== card && isVisible(document.getElementById(other.overlayId)));
        const fromCard = openOther
            ? { type: openOther.type, id: openOther.getId() }
            : (lastClosed && Date.now() - lastClosed.at < RECENT_CLOSE_MS && lastClosed.href === window.location.href ? lastClosed.card : null);
        if (fromCard?.id) writeStateCard(withPushedMark(fromCard));
        lastClosed = null;
        goToPage(card.pageKey);
        writeStateCard({ type: card.type, id, pushed: true });
        cards.forEach((other) => {
            if (other !== card && isVisible(document.getElementById(other.overlayId))) other.close();
        });
    };

    const onCardHidden = (card) => {
        const stateCard = getStateCard();
        if (!stateCard || stateCard.type !== card.type) return;
        lastClosed = { card: stateCard, at: Date.now(), href: window.location.href };
        writeStateCard(null);
    };

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            const card = cardByOverlayId.get(mutation.target?.id);
            if (!card) return;
            const now = isVisible(mutation.target);
            const was = !(mutation.oldValue || '').split(/\s+/).includes('hidden');
            if (now === was) return;
            if (now) onCardShown(card);
            else onCardHidden(card);
        });
    });

    const observeMountedCards = () => {
        cards.forEach((card) => {
            const el = document.getElementById(card.overlayId);
            if (!el || el.dataset.cardRouted) return;
            el.dataset.cardRouted = '1';
            observer.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        });
    };

    // Cards mount lazily, so watch the body for them to appear.
    const mountObserver = new MutationObserver(observeMountedCards);
    mountObserver.observe(document.body, { childList: true, subtree: true });
    observeMountedCards();

    const goBack = (card) => {
        const stateCard = getStateCard();
        if (stateCard?.type === card.type && stateCard.pushed) {
            window.history.back();
            return;
        }
        card.close();
    };

    // Capture phase: the card panels stop click propagation for their own menus.
    document.addEventListener('click', (event) => {
        // While a card's edit form is open, Cancel and Save are the only way out: a click
        // on the dimmed backdrop does not close it.
        if (event.target?.classList?.contains('app-card') && isEditingCard(event.target)) {
            event.stopPropagation();
            return;
        }
        const button = event.target?.closest?.('[data-card-back], [data-card-close]');
        if (!button) return;
        const card = cardByOverlayId.get(button.closest('.app-card')?.id);
        if (!card) return;
        event.preventDefault();
        event.stopPropagation();
        // The X closes the card and leaves you on the page under it.
        if (button.hasAttribute('data-card-close')) card.close();
        else goBack(card);
    }, true);

    // After Back/Forward has set the page: show the card this entry remembers.
    const restoreCard = () => {
        const target = getStateCard();
        isRestoring = true;
        cards.forEach((card) => {
            if (target && card.type === target.type) return;
            if (isVisible(document.getElementById(card.overlayId))) card.close();
        });
        const card = target ? cardByType.get(target.type) : null;
        const isOpen = card && isVisible(document.getElementById(card.overlayId)) && card.getId() === target.id;
        Promise.resolve(card && target.id && !isOpen ? card.open(target.id) : null)
            .catch(() => {})
            // Let the observers see the restored state before normal routing resumes.
            .finally(() => setTimeout(() => { isRestoring = false; }, 0));
    };

    return { restoreCard };
};
