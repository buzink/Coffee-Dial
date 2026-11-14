// The product photo of a shop page, for Extract From URL.
//
// First in the browser: Shopify shops allow other sites to read their pages and
// images (CORS), so the app reads the page, finds the photo and downloads it.
// Most other shops do not allow that, so the fetchShopImage Cloud Function does
// the same on the server. If both fail the coffee is simply added without photo.

const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif|avif)$/i;

const resolve = (value, pageUrl) => {
    if (!value) return '';
    try {
        return new URL(value.replace(/&amp;/g, '&'), pageUrl).toString();
    } catch (_) {
        return '';
    }
};

const findJsonLdProductImage = (doc) => {
    const pick = (image) => {
        if (typeof image === 'string') return image;
        if (Array.isArray(image)) return pick(image[0]);
        return image && typeof image === 'object' ? image.url || '' : '';
    };
    const visit = (node) => {
        if (!node || typeof node !== 'object') return '';
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item);
                if (found) return found;
            }
            return '';
        }
        if ([].concat(node['@type'] || []).includes('Product')) {
            const image = pick(node.image);
            if (image) return image;
        }
        return visit(node['@graph']);
    };
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
            const found = visit(JSON.parse(script.textContent || ''));
            if (found) return found;
        } catch (_) { /* not valid JSON: try the next block */ }
    }
    return '';
};

// Same order as the Cloud Function: og:image, twitter:image, link rel=image_src,
// the schema.org Product image, then the WooCommerce gallery image.
export const findPageImageUrl = (html, pageUrl) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const candidates = [
        doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content'),
        doc.querySelector('meta[property="og:image"]')?.getAttribute('content'),
        doc.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]')?.getAttribute('content'),
        doc.querySelector('link[rel="image_src"]')?.getAttribute('href'),
        findJsonLdProductImage(doc),
        doc.querySelector('[data-large_image]')?.getAttribute('data-large_image')
    ];
    for (const candidate of candidates) {
        const url = resolve(`${candidate || ''}`.trim(), pageUrl);
        if (url) return url;
    }
    return '';
};

const fetchImageInBrowser = async (imageUrl) => {
    const image = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!image.ok) throw new Error(`Photo answered ${image.status}`);
    const blob = await image.blob();
    if (!IMAGE_TYPE.test(blob.type)) throw new Error('Not an image');
    return blob;
};

const fetchInBrowser = async (pageUrl) => {
    const page = await fetch(pageUrl, { mode: 'cors', credentials: 'omit' });
    if (!page.ok) throw new Error(`Page answered ${page.status}`);
    const pageType = (page.headers.get('content-type') || '').split(';')[0].trim();
    if (IMAGE_TYPE.test(pageType)) return page.blob();
    const imageUrl = findPageImageUrl(await page.text(), page.url || pageUrl);
    if (!imageUrl) throw new Error('No photo on the page');
    return fetchImageInBrowser(imageUrl);
};

const base64ToBlob = (base64, mimeType) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
};

// Resolves with the photo as a Blob, or null when there is none to be had. Order: the page
// in the browser; the photo address Gemini read on the page (imageUrlHint, a promise),
// downloaded in the browser (shops such as Wix block their pages but not their images);
// then the fetchShopImage function.
export const fetchPageImage = async (pageUrl, { callFetchShopImage = null, imageUrlHint = null } = {}) => {
    try {
        return await fetchInBrowser(pageUrl);
    } catch (browserError) {
        try {
            const hinted = resolve(`${(await imageUrlHint) || ''}`.trim(), pageUrl);
            if (hinted) return await fetchImageInBrowser(hinted);
        } catch (_) { /* the hinted photo cannot be downloaded here either: ask the server */ }
        if (typeof callFetchShopImage !== 'function') return null;
        try {
            const result = await callFetchShopImage({ url: pageUrl });
            const { data, mimeType } = result?.data || {};
            return data && IMAGE_TYPE.test(mimeType || '') ? base64ToBlob(data, mimeType) : null;
        } catch (serverError) {
            console.warn('[Extract] No photo for this page', { browser: browserError?.message, server: serverError?.message });
            return null;
        }
    }
};
