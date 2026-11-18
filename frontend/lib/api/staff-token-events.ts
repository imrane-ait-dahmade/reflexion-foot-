const STAFF_TOKEN_EVENT = "ccf-staff-token-change";

export function subscribeStaffTokenChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(STAFF_TOKEN_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(STAFF_TOKEN_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function notifyStaffTokenChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STAFF_TOKEN_EVENT));
  }
}
