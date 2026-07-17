import type { BuBuDesktopApi } from "../shared/product-api.js";

declare global {
  interface Window {
    readonly bubu: BuBuDesktopApi;
  }
}

export {};
