// @ts-nocheck

import {
  extension,
  Banner,
  Text,
} from "@shopify/ui-extensions";

export default extension(
  "customer-account.order-status.block.render",
  (root, { i18n }) => {

    const banner = root.createComponent(Banner);

    const text = root.createComponent(
      Text,
      {},
      i18n.translate("earnPoints")
    );

    banner.appendChild(text);
    root.appendChild(banner);
  }
);