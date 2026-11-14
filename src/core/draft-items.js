// New beans, coffees and gear start as drafts: they live only in the local list,
// with the id their document will get, until the user clicks Save. Discard or
// closing the card removes them again, so no empty item is ever written.

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Same shape as a Firestore auto-id (20 characters), so the draft keeps its id when saved.
export const createDraftId = () => {
    const bytes = new Uint8Array(20);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
};

export const isDraftItem = (item) => !!item?.isDraft;

export const withoutDrafts = (items) => (Array.isArray(items) ? items.filter((item) => !isDraftItem(item)) : items);

// The fields to write when a draft is saved: everything but the id and the draft flag.
export const toSavedFields = (item) => {
    const { id, isDraft, ...fields } = item || {};
    return fields;
};

// While a draft is open its card shows "Add <type>", Discard and "Save <type>"
// (styled by [data-adding] in app.css) instead of the title, Cancel and Save.
export const setCardAddingMode = (overlayId, adding) => {
    const overlay = typeof document !== 'undefined' ? document.getElementById(overlayId) : null;
    if (overlay) overlay.toggleAttribute('data-adding', !!adding);
};
