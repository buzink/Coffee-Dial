// fetchShopImage: returns the product photo of a coffee shop page.
//
// The app tries this in the browser first, but most shops that are not on
// Shopify send no CORS headers, so the browser may not download their pages
// or images. This callable does the same work on the server: it reads the
// page's og:image (or takes the URL as the image itself), downloads the image
// and returns it as base64. Only signed-in users may call it, and it refuses
// private or internal addresses so it cannot be used to reach our network.

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const dns = require("node:dns").promises;
const net = require("node:net");

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 10000;
const IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
];
// Shops rate-limit or block bot-like agents, so ask like a normal browser.
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * True for loopback, private, link-local, carrier-grade NAT, multicast and
 * other non-public addresses (IPv4 and IPv6).
 * @param {string} address
 * @return {boolean}
 */
function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

/**
 * Parses and checks a URL: http(s) only, default ports, public host.
 * @param {string} rawUrl
 * @return {Promise<URL>}
 */
async function assertPublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_) {
    throw new HttpsError("invalid-argument", "This is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpsError("invalid-argument", "Only web addresses work.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new HttpsError("invalid-argument", "This port is not allowed.");
  }
  if (url.username || url.password) {
    throw new HttpsError("invalid-argument", "URLs with a login are refused.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ?
    [{address: host}] :
    await dns.lookup(host, {all: true}).catch(() => []);
  if (!addresses.length) {
    throw new HttpsError("not-found", "This website could not be found.");
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new HttpsError("permission-denied", "This address is not allowed.");
  }
  return url;
}

/**
 * Fetches a public URL, following redirects by hand so every hop is checked.
 * @param {string} rawUrl
 * @param {string} accept
 * @return {Promise<{response: Response, url: string}>}
 */
async function fetchPublic(rawUrl, accept) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        "accept": accept,
        "accept-language": "en,nl;q=0.8",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      throw new HttpsError("unavailable",
          `The website answered with status ${response.status}.`);
    }
    return {response, url: url.toString()};
  }
  throw new HttpsError("unavailable", "The website redirected too often.");
}

/**
 * Reads a response body, refusing it once it grows past the limit.
 * @param {Response} response
 * @param {number} limit
 * @return {Promise<Buffer>}
 */
async function readLimited(response, limit) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) {
    throw new HttpsError("resource-exhausted", "The file is too large.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) {
      throw new HttpsError("resource-exhausted", "The file is too large.");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * The first image of a schema.org Product in the page's JSON-LD blocks.
 * @param {string} html
 * @return {string}
 */
function findJsonLdProductImage(html) {
  const blocks = html.match(
      /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const pickImage = (image) => {
    if (typeof image === "string") return image;
    if (Array.isArray(image)) return pickImage(image[0]);
    if (image && typeof image === "object") return image.url || "";
    return "";
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return "";
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return "";
    }
    const types = [].concat(node["@type"] || []);
    if (types.includes("Product")) {
      const image = pickImage(node.image);
      if (image) return image;
    }
    return visit(node["@graph"]);
  };
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "")
        .replace(/<\/script>$/i, "");
    try {
      const found = visit(JSON.parse(json));
      if (found) return found;
    } catch (_) {
      continue;
    }
  }
  return "";
}

/**
 * Finds the product photo of an HTML page: og:image, twitter:image,
 * link rel=image_src, the schema.org Product image, then the WooCommerce
 * gallery image. Relative addresses are resolved against the page.
 * @param {string} html
 * @param {string} pageUrl
 * @return {string}
 */
function findPageImageUrl(html, pageUrl) {
  const tags = html.match(/<(meta|link)\b[^>]*>/gi) || [];
  const attr = (tag, name) => {
    const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
    const match = tag.match(re);
    return match ? (match[2] ?? match[3] ?? "").trim() : "";
  };
  const wanted = [
    ["meta", "og:image:secure_url"], ["meta", "og:image"],
    ["meta", "twitter:image"], ["link", "image_src"],
  ];
  for (const [kind, key] of wanted) {
    for (const tag of tags) {
      if (!tag.toLowerCase().startsWith(`<${kind}`)) continue;
      const name = kind === "link" ?
        attr(tag, "rel") :
        attr(tag, "property") || attr(tag, "name");
      if (name.toLowerCase() !== key) continue;
      const value = kind === "link" ? attr(tag, "href") : attr(tag, "content");
      if (!value) continue;
      try {
        return new URL(value.replace(/&amp;/g, "&"), pageUrl).toString();
      } catch (_) {
        continue;
      }
    }
  }
  const woo = html.match(/data-large_image\s*=\s*"([^"]+)"/i);
  const fallback = findJsonLdProductImage(html) || (woo ? woo[1] : "");
  if (!fallback) return "";
  try {
    return new URL(fallback.replace(/&amp;/g, "&"), pageUrl).toString();
  } catch (_) {
    return "";
  }
}

/**
 * The image type from a Content-Type header, or "" when it is not an image.
 * @param {string|null} header
 * @return {string}
 */
function imageType(header) {
  const type = `${header || ""}`.split(";")[0].trim().toLowerCase();
  return IMAGE_TYPES.includes(type) ? type : "";
}

exports.fetchShopImage = onCall({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 5,
}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const rawUrl = `${request.data?.url || ""}`.trim();
  if (!rawUrl || rawUrl.length > 2048) {
    throw new HttpsError("invalid-argument", "Send the URL of a page.");
  }

  const page = await fetchPublic(rawUrl, "text/html,image/*;q=0.9,*/*;q=0.5");
  let imageResponse = page.response;
  let imageUrl = page.url;
  if (!imageType(page.response.headers.get("content-type"))) {
    const html = (await readLimited(page.response, MAX_PAGE_BYTES))
        .toString("utf8");
    const found = findPageImageUrl(html, page.url);
    if (!found) {
      throw new HttpsError("not-found", "No photo found on this page.");
    }
    const image = await fetchPublic(found, "image/*");
    imageResponse = image.response;
    imageUrl = image.url;
  }

  const mimeType = imageType(imageResponse.headers.get("content-type"));
  if (!mimeType) {
    throw new HttpsError("failed-precondition", "The photo is not an image.");
  }
  const bytes = await readLimited(imageResponse, MAX_IMAGE_BYTES);
  return {mimeType, imageUrl, data: bytes.toString("base64")};
});

exports.findPageImageUrl = findPageImageUrl;
exports.isPrivateAddress = isPrivateAddress;
