import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
