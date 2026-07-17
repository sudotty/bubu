import { contextBridge, ipcRenderer } from "electron";
import {
  desktopChannels,
  type BuBuDesktopApi,
  type ProductReadiness,
} from "./shared/product-api.js";

const desktopApi: BuBuDesktopApi = {
  system: {
    getReadiness: () =>
      ipcRenderer.invoke(desktopChannels.getReadiness) as Promise<ProductReadiness>,
  },
};

contextBridge.exposeInMainWorld("bubu", desktopApi);
