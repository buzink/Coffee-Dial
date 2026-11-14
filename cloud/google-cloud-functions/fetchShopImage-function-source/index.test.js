const test = require("node:test");
const assert = require("node:assert/strict");
const {findPageImageUrl, isPrivateAddress} = require("./index.js");

test("finds og:image and resolves it against the page", () => {
  const html = `<head><meta property="og:image"
    content="/cdn/shop/files/bag.jpg?v=1&amp;width=800"></head>`;
  assert.equal(
      findPageImageUrl(html, "https://shop.example.com/products/x"),
      "https://shop.example.com/cdn/shop/files/bag.jpg?v=1&width=800",
  );
});

test("prefers og:image over twitter:image, with either attribute order", () => {
  const html = `<meta name="twitter:image" content="https://a.example/t.jpg">
    <meta content="https://a.example/og.jpg" property="og:image">`;
  assert.equal(findPageImageUrl(html, "https://a.example/"),
      "https://a.example/og.jpg");
});

test("falls back to link rel=image_src and returns empty without image", () => {
  assert.equal(findPageImageUrl(
      `<link rel="image_src" href="//cdn.example/i.png">`,
      "https://a.example/p"), "https://cdn.example/i.png");
  assert.equal(findPageImageUrl("<p>no image</p>", "https://a.example/"), "");
});

test("refuses private and internal addresses", () => {
  ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1",
    "not-an-ip"].forEach((address) => {
    assert.equal(isPrivateAddress(address), true, address);
  });
  ["8.8.8.8", "151.101.1.1", "2606:4700::1111"].forEach((address) => {
    assert.equal(isPrivateAddress(address), false, address);
  });
});

test("falls back to the schema.org Product image, then WooCommerce", () => {
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org",
    "@graph":[{"@type":"WebPage"},{"@type":"Product",
    "image":["https://w.example/wp-content/uploads/bag.png"]}]}</script>`;
  assert.equal(findPageImageUrl(ld, "https://w.example/p"),
      "https://w.example/wp-content/uploads/bag.png");
  assert.equal(findPageImageUrl(
      `<div data-large_image="/wp-content/uploads/big.jpg"></div>`,
      "https://w.example/p"), "https://w.example/wp-content/uploads/big.jpg");
});
