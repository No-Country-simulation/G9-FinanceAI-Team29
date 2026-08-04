export const SUPPORT_SUCCESS_EVENT = "finsight:support-success";

export function notifySupportMailOpened() {
  window.dispatchEvent(new CustomEvent(SUPPORT_SUCCESS_EVENT));
}
