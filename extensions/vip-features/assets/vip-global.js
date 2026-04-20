document.addEventListener("DOMContentLoaded", () => {

  // Injected by Liquid only for VIP customers via vip-embed.liquid
  addNavbarVIPBadge();
  applyCollectionDiscounts();
});



/* ---------------- VIP BADGE ---------------- */

function addNavbarVIPBadge() {

  // Prevent duplicate
  if (document.querySelector('.vip-navbar-badge')) {
    console.log("[VIP GLOBAL] Badge already exists — skipping.");
    return;
  }

  // Try multiple selectors — Dawn and other themes use different class names
  const HEADER_SELECTORS = [
    '.header__icons',            // Dawn default
    '.header-wrapper .icons',    // some variants
    '.site-header__icons',       // Debut
    '.header__icon-list',        // Impulse / other
    'header .header__icons',
    '.shopify-section-header .header__icons',
    'header-drawer',             // Dawn v8+
    '.header__heading-link',     // fallback: prepend near logo
  ];

  let iconsContainer = null;

  for (const selector of HEADER_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) {
      iconsContainer = el;
      break;
    }
  }

  if (!iconsContainer) return;

  const badge = document.createElement('div');
  badge.className = 'vip-navbar-badge';

  badge.innerHTML = `
    <span style="
      background: gold;
      color: black;
      font-size: 14px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 6px;
      margin-right: 10px;
      margin-top: 3px;
      display: inline-block;
      vertical-align: middle;
    ">
      &#9733; VIP MEMBER
    </span>
  `;

  iconsContainer.prepend(badge);
}

/* ---------------- DISCOUNT ---------------- */

function applyCollectionDiscounts() {
  const cards = document.querySelectorAll('.card-wrapper');

  if (cards.length === 0) return;

  cards.forEach(card => {
    // Prevent running twice
    if (card.querySelector('.vip-discounted')) return;

    const priceContainer = card.querySelector('.price');
    if (!priceContainer) return;

    const discount = window.APP_CONFIG?.discount;
    if (!discount || discount <= 0) return;

    const raw = priceContainer.innerText;

    const matches = raw.replace(/,/g, '').match(/[\d.]+/g);
    if (!matches || matches.length === 0) return;

    const price = parseFloat(matches[matches.length - 1]);
    if (!price || isNaN(price)) return;

    const discounted = price - (price * discount / 100);

    priceContainer.innerHTML = `
      <span style="text-decoration: line-through; opacity:0.6;">
        &#8377;${price.toFixed(2)}
      </span>
      <span class="vip-discounted" style="color:red; font-weight:bold; margin-left:6px;">
        &#8377;${discounted.toFixed(2)}
      </span>
    `;
  });
}