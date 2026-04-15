/**
 * bundle-inject.js
 * Injects a "Bundle Includes" collapsible UI inside the cart item (page + drawer).
 * Plain JavaScript — no Liquid, no framework.
 *
 * HOW TO INSTALL:
 *   Add this file to your theme's /assets/ folder, then include it in theme.liquid:
 *   <script src="{{ 'bundle-inject.js' | asset_url }}" defer></script>
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG — adjust these to match your store
  ───────────────────────────────────────────── */

  // Fallback: if no _gift property, match by numeric variant ID.
  // Set to null to disable variant-ID matching.
  const GIFT_VARIANT_ID = null; // e.g. 12345678901234

  // How often (ms) to retry finding the cart item DOM element
  const RETRY_INTERVAL = 600;
  const MAX_RETRIES = 10;

  /* ─────────────────────────────────────────────
     STEP 1 — Fetch cart JSON
  ───────────────────────────────────────────── */

  async function fetchCart() {
    console.log("[BundleInject] Fetching cart from /cart.js …");
    try {
      const res = await fetch("/cart.js");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cart = await res.json();
      console.log("[BundleInject] Cart fetched. Items:", cart.items.length);
      return cart;
    } catch (err) {
      console.error("[BundleInject] Failed to fetch cart:", err);
      return null;
    }
  }

  /* ─────────────────────────────────────────────
     STEP 2 — Identify the gift item
  ───────────────────────────────────────────── */

  function findGiftItem(cart) {
    const gift = cart.items.find((item) => {
      const byProp = item.properties && item.properties._gift === "true";
      const byVariant =
        GIFT_VARIANT_ID && String(item.variant_id) === String(GIFT_VARIANT_ID);
      return byProp || byVariant;
    });

    if (gift) {
      console.log("[BundleInject] Gift item found:", gift.title, "| key:", gift.key);
    } else {
      console.warn("[BundleInject] No gift item found in cart.");
    }
    return gift || null;
  }

  /* ─────────────────────────────────────────────
     STEP 3 — Read bundled handles from metafields
  ───────────────────────────────────────────── */

  

  /**
   * Reads bundled handles from the cart item's `product_description`
   * or a custom line item property — OR from a global window variable
   * that your theme snippet can expose.
   *
   * BEST PRACTICE for Shopify metafields in JS:
   *   In your theme (theme.liquid or a snippet), expose metafields as JSON:
   *
   *   <script>
   *     window.__bundleMetafields = window.__bundleMetafields || {};
   *     {% for item in cart.items %}
   *       window.__bundleMetafields["{{ item.key }}"] =
   *         {{ item.product.metafields.bundle.products.value | json }};
   *     {% endfor %}
   *   </script>
   *
   *   This file then reads from window.__bundleMetafields[item.key].
   *
   * If you cannot use any Liquid at all, use the /products/{handle}.json
   * approach via a Storefront API token (see fetchHandlesViaStorefront below).
   */
  

  /* ─────────────────────────────────────────────
     STEP 4 — Fetch product info (title + image)
             for each handle via /products/{handle}.js
  ───────────────────────────────────────────── */



  /* ─────────────────────────────────────────────
     STEP 5 — Find the cart item DOM element
  ───────────────────────────────────────────── */

  /**
   * Tries several common selectors used by Shopify themes.
   * Returns the matching element or null.
   */
  function findCartItemElement(giftItem) {
    const key = giftItem.key;
    const variantId = String(giftItem.variant_id);

    // Ordered list of selector strategies (covers Dawn, Debut, Impulse, custom themes)
    const strategies = [
      // data-key attribute (Dawn, most modern themes)
      () => document.querySelector(`[data-key="${key}"]`),
      // data-variant-id
      () => document.querySelector(`[data-variant-id="${variantId}"]`),
      // data-cart-item with key
      () => document.querySelector(`[data-cart-item="${key}"]`),
      // name attribute on quantity input (many themes)
      () => {
        const input = document.querySelector(`input[name="updates[${key}]"]`);
        return input ? input.closest("tr, li, div.cart__item, .cart-item, [class*='cart'][class*='item']") : null;
      },
      // href contains variant id (some themes link the product image)
            () => {
        const link = document.querySelector(`a[href*="/products/"][href*="${variantId}"]`);
        return link ? link.closest("tr.cart-item, li.cart-item, .cart-item, [class*='cart-item']") : null;
        },
    ];

    for (const strategy of strategies) {
      try {
        const el = strategy();
        if (el) {
          console.log("[BundleInject] Cart item element found via strategy:", strategy.toString().slice(0, 60));
          return el;
        }
      } catch (e) { /* continue */ }
    }

    console.warn("[BundleInject] Could not find cart item DOM element for key:", key);
    return null;
  }

  /* ─────────────────────────────────────────────
     STEP 6 — Build and inject the UI
  ───────────────────────────────────────────── */

  function buildBundleUI(products, giftItemKey) {
    const uid = `bundle-drawer-${giftItemKey.replace(/:/g, "-")}`;

    const wrapper = document.createElement("div");
    wrapper.className = "bundle-inject-wrapper";
    wrapper.dataset.bundleKey = giftItemKey;
    wrapper.style.cssText = `
      margin-top: 10px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      font-family: inherit;
      font-size: 13px;
    `;

    // ── Toggle button ──
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", uid);
    toggle.style.cssText = `
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 14px;
      background: #eeecea;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: #444;
      text-align: left;
    `;
    toggle.innerHTML = `
      <span>BUNDLE INCLUDES (${products.length} ${products.length === 1 ? "ITEM" : "ITEMS"})</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="#666" stroke-width="2.5"
           style="transition:transform 0.25s ease;flex-shrink:0;"
           class="bundle-chevron">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    `;

    // ── Drawer body ──
    const body = document.createElement("div");
    body.id = uid;
    body.style.cssText = `
      display: none;
      flex-direction: column;
      background: #f9f8f6;
      padding: 0 14px;
    `;

    products.forEach((p, i) => {
      const isLast = i === products.length - 1;
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        ${isLast ? "" : "border-bottom: 1px dashed #e5e5e5;"}
      `;

      const imgEl = p.image
        ? `<img src="${p.image}" alt="${escapeAttr(p.title)}"
             width="36" height="50" loading="lazy"
             style="width:36px;height:50px;object-fit:cover;border-radius:4px;
                    border:1px solid #e5e5e5;flex-shrink:0;" />`
        : `<div style="width:36px;height:50px;border-radius:4px;
                       background:#e5e5e5;flex-shrink:0;"></div>`;

      row.innerHTML = `
        ${imgEl}
        <div style="flex:1;min-width:0;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:#1a1a1a;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(p.title)}
          </p>
          <p style="margin:0;font-size:11px;color:#999;">1&times; included</p>
        </div>
      `;
      body.appendChild(row);
    });

    // ── Toggle logic ──
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      const chevron = toggle.querySelector(".bundle-chevron");
      if (isOpen) {
        toggle.setAttribute("aria-expanded", "false");
        body.style.display = "none";
        if (chevron) chevron.style.transform = "rotate(0deg)";
      } else {
        toggle.setAttribute("aria-expanded", "true");
        body.style.display = "flex";
        if (chevron) chevron.style.transform = "rotate(180deg)";
      }
    });

    // Hover style for toggle
    toggle.addEventListener("mouseenter", () => { toggle.style.background = "#e5e3e0"; });
    toggle.addEventListener("mouseleave", () => { toggle.style.background = "#eeecea"; });

    wrapper.appendChild(toggle);
    wrapper.appendChild(body);
    return wrapper;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  /* ─────────────────────────────────────────────
     STEP 7 — Find injection anchor inside element
  ───────────────────────────────────────────── */

  /**
   * Inside the cart item element, find the best place to append the bundle UI.
   * We want to go INSIDE the item, after the product title/price area.
   */
  function findInjectionAnchor(cartItemEl) {
    // 🎯 ALWAYS target the details/content section
    const details =
        cartItemEl.querySelector(".cart-item__details") ||
        cartItemEl.querySelector(".cart-item__content") ||
        cartItemEl.querySelector(".cart__item-details");

    if (details) return details;

    // fallback: find first TD inside row
    if (cartItemEl.tagName === "TR") {
        return cartItemEl.querySelector("td:nth-child(2)") || cartItemEl.querySelector("td");
    }

    return cartItemEl;
    }

  /* ─────────────────────────────────────────────
     MAIN — orchestrate everything
  ───────────────────────────────────────────── */

  async function run() {
    console.log("[BundleInject] ── Running bundle injection ──");

    const isCartPage =
        window.location.pathname.includes("/cart") ||
        document.querySelector("cart-drawer") ||
        document.querySelector("[class*='cart-drawer']") ||
        document.querySelector("[id*='CartDrawer']");

    if (!isCartPage) {
        console.log("[BundleInject] Not cart page/drawer. Skipping.");
        return;
    }

    // Prevent running if no cart items container visible yet
    const cart = await fetchCart();
    if (!cart || !cart.items.length) {
      console.log("[BundleInject] Cart empty or unavailable. Skipping.");
      return;
    }

    const giftItem = findGiftItem(cart);
    if (!giftItem) return;

    const products = window.__bundleMetafields[giftItem.key] || [];

    if (!products.length) {
    console.warn("[BundleInject] No bundle products. Nothing to inject.");
    return;
    }

    console.log("[BundleInject] Products from metafield:", products);

    // Fetch product info for all handles in parallel
    console.log("[BundleInject] Product info fetched:", products.map((p) => p.title));

    // Retry finding DOM element — AJAX drawers may not be in DOM yet
    let retries = 0;
    const tryInject = () => {
      retries++;
      console.log(`[BundleInject] DOM search attempt ${retries}/${MAX_RETRIES} …`);

      const cartItemEl = findCartItemElement(giftItem);

      if (!cartItemEl) {
        if (retries < MAX_RETRIES) {
          setTimeout(tryInject, RETRY_INTERVAL);
        } else {
          console.error("[BundleInject] Gave up finding cart item element after", MAX_RETRIES, "attempts.");
        }
        return;
      }

      // ── Prevent duplicate injection ──
      if (cartItemEl.querySelector(".bundle-inject-wrapper")) {
        console.log("[BundleInject] Bundle UI already injected for this item. Skipping.");
        return;
      }

      const anchor = findInjectionAnchor(cartItemEl);
      const ui = buildBundleUI(products, giftItem.key);
      anchor.appendChild(ui);
      console.log("[BundleInject] ✅ Bundle UI injected successfully into:", anchor);
    };

    tryInject();
  }

  /* ─────────────────────────────────────────────
     INITIALISE + RE-RUN ON CART UPDATES
  ───────────────────────────────────────────── */

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // Re-run on Shopify AJAX cart events (covers most themes)
  const cartUpdateEvents = [
    "cart:refresh",          // some themes
    "cart:updated",          // some themes
    "drawer:open",           // some drawer themes
    "cart-drawer:open",      // Dawn
    "on:cart:change",        // Broadcast theme
  ];
  cartUpdateEvents.forEach((evtName) => {
    document.addEventListener(evtName, () => {
      console.log(`[BundleInject] Cart event "${evtName}" detected. Re-running …`);
      // Small delay to let the DOM update first
      setTimeout(run, 400);
    });
  });

  // Also observe body for AJAX cart drawer being inserted/updated
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        // If a cart drawer or cart items container appeared
        const isCartRelated =
          node.matches && (
            node.matches("[id*='cart'], [class*='cart'], cart-drawer, cart-notification") ||
            node.querySelector("[id*='cart'], [class*='cart-item']")
          );
        if (isCartRelated) {
          console.log("[BundleInject] Cart-related DOM mutation detected. Re-running …");
          setTimeout(run, 400);
          return; // only trigger once per batch
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Expose run() globally so themes can call it manually if needed
  window.BundleInject = { run };
  console.log("[BundleInject] Initialized. Call window.BundleInject.run() to trigger manually.");

})();