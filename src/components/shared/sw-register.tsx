"use client";

import { useEffect } from "react";

/**
 * The app used to register an offline-first service worker. It's retired:
 * unregister any lingering workers and drop their caches so returning
 * visitors get fresh pages straight from the network.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .catch(() => undefined);
    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith("forma-")).map((k) => caches.delete(k)))
        )
        .catch(() => undefined);
    }
  }, []);

  return null;
}
