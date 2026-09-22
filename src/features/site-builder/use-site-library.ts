"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MAX_SITES, MAX_SNAPSHOTS, STORAGE_KEY, migrateSite, newId, newSite, validSites,
  type Site, type Snapshot,
} from "@/lib/site-builder";

const ACTIVE_KEY = `${STORAGE_KEY}:active`;
const HISTORY_LIMIT = 60;
/** Typing shouldn't fill the undo stack one letter at a time. */
const COALESCE_MS = 550;

export interface SiteLibrary {
  sites: Site[];
  site: Site;
  activeId: string;
  ready: boolean;
  /** True when nothing was stored yet — the very first visit. */
  fresh: boolean;
  status: string;
  blocked: boolean;
  recovery: string;
  canUndo: boolean;
  canRedo: boolean;
  update: (patch: Partial<Site> | ((site: Site) => Partial<Site>), options?: { tag?: string; silent?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  open: (id: string) => void;
  add: (site: Site) => void;
  duplicate: () => void;
  remove: (id: string) => void;
  saveSnapshot: (name: string) => void;
  restoreSnapshot: (snapshot: Snapshot) => void;
  dropSnapshot: (id: string) => void;
  importSites: (raw: string) => boolean;
  acceptOverwrite: () => void;
}

export function useSiteLibrary(makeFirst: () => Site): SiteLibrary {
  const [sites, setSites] = useState<Site[]>(() => [makeFirst()]);
  const [activeId, setActiveId] = useState(() => "");
  const [ready, setReady] = useState(false);
  const [fresh, setFresh] = useState(true);
  const [status, setStatus] = useState("Opening your workspace…");
  const [blocked, setBlocked] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [past, setPast] = useState<Site[]>([]);
  const [future, setFuture] = useState<Site[]>([]);
  const lastPush = useRef({ at: 0, tag: "" });

  const site = sites.find((entry) => entry.id === activeId) ?? sites[0];

  useEffect(() => {
    // Deferred a tick so the first paint matches the server render.
    const timer = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!validSites(parsed)) throw new Error("unreadable");
          const stored = parsed.map(migrateSite);
          const last = localStorage.getItem(ACTIVE_KEY);
          setSites(stored);
          setActiveId(stored.some((entry) => entry.id === last) ? last! : stored[0].id);
          setFresh(false);
        }
        setStatus("All changes saved");
      } catch {
        setBlocked(true);
        setRecovery(raw ?? "");
        setStatus("Saving paused. The stored library could not be read");
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || blocked) return;
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
        localStorage.setItem(ACTIVE_KEY, site.id);
        setStatus("All changes saved");
      } catch {
        setStatus("Out of browser storage. Download a backup");
      }
    };
    const timer = setTimeout(save, 400);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [sites, site.id, ready, blocked]);

  const update = useCallback<SiteLibrary["update"]>((patch, options = {}) => {
    setSites((current) => {
      const target = current.find((entry) => entry.id === activeId) ?? current[0];
      const changes = typeof patch === "function" ? patch(target) : patch;
      if (!options.silent) {
        const now = Date.now();
        const sameRun = options.tag && options.tag === lastPush.current.tag && now - lastPush.current.at < COALESCE_MS;
        if (!sameRun) {
          setPast((stack) => [...stack, target].slice(-HISTORY_LIMIT));
          setFuture([]);
        }
        lastPush.current = { at: now, tag: options.tag ?? "" };
      }
      return current.map((entry) => (entry.id === target.id ? { ...entry, ...changes, updated: Date.now() } : entry));
    });
    if (!blocked) setStatus("Saving…");
  }, [activeId, blocked]);

  const step = useCallback((direction: "undo" | "redo") => {
    const from = direction === "undo" ? past : future;
    const previous = from.at(-1);
    if (!previous) return;
    setSites((current) => {
      const target = current.find((entry) => entry.id === activeId) ?? current[0];
      if (direction === "undo") {
        setPast((stack) => stack.slice(0, -1));
        setFuture((stack) => [...stack, target].slice(-HISTORY_LIMIT));
      } else {
        setFuture((stack) => stack.slice(0, -1));
        setPast((stack) => [...stack, target].slice(-HISTORY_LIMIT));
      }
      return current.map((entry) => (entry.id === previous.id ? previous : entry));
    });
    lastPush.current = { at: 0, tag: "" };
  }, [activeId, past, future]);

  const open = useCallback((id: string) => {
    setActiveId(id);
    setPast([]);
    setFuture([]);
  }, []);

  const add = useCallback((next: Site) => {
    setFresh(false);
    setSites((current) => {
      if (current.length >= MAX_SITES) {
        toast.error(`Your library holds ${MAX_SITES} sites. Back one up and remove it first.`);
        return current;
      }
      return [next, ...current];
    });
    open(next.id);
  }, [open]);

  const duplicate = useCallback(() => {
    const copy: Site = {
      ...structuredClone(site),
      id: newId(),
      name: `${site.name} copy`,
      updated: Date.now(),
    };
    add(copy);
    toast.success("Copied. You are now editing the copy.");
  }, [site, add]);

  const remove = useCallback((id: string) => {
    setSites((current) => {
      const rest = current.filter((entry) => entry.id !== id);
      const next = rest.length ? rest : [newSite()];
      if (id === activeId) open(next[0].id);
      return next;
    });
  }, [activeId, open]);

  const saveSnapshot = useCallback((name: string) => {
    if (site.snapshots.length >= MAX_SNAPSHOTS) {
      toast.error(`This site keeps ${MAX_SNAPSHOTS} versions. Delete an old one first.`);
      return;
    }
    update((current) => ({
      snapshots: [
        { id: newId(), name: name.trim() || `Version ${current.snapshots.length + 1}`, date: Date.now(), blocks: structuredClone(current.blocks), theme: { ...current.theme } },
        ...current.snapshots,
      ],
    }));
    toast.success("Version saved");
  }, [site.snapshots.length, update]);

  const restoreSnapshot = useCallback((snapshot: Snapshot) => {
    update({ blocks: structuredClone(snapshot.blocks), theme: { ...snapshot.theme } });
    toast.success(`Restored “${snapshot.name}”`);
  }, [update]);

  const dropSnapshot = useCallback((id: string) => {
    update((current) => ({ snapshots: current.snapshots.filter((entry) => entry.id !== id) }));
  }, [update]);

  const importSites = useCallback((raw: string) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (!validSites(list)) throw new Error("bad file");
      const fresh = list.map((entry) => ({ ...migrateSite(entry), id: newId(), updated: Date.now() }));
      setSites((current) => {
        if (current.length + fresh.length > MAX_SITES) {
          toast.error("That import would go past the library limit.");
          return current;
        }
        return [...fresh, ...current];
      });
      open(fresh[0].id);
      toast.success(`Imported ${fresh.length} ${fresh.length === 1 ? "site" : "sites"}. Nothing was replaced.`);
      return true;
    } catch {
      toast.error("That file is not a Website Builder backup. Nothing changed.");
      return false;
    }
  }, [open]);

  const acceptOverwrite = useCallback(() => {
    setBlocked(false);
    setStatus("Saving…");
  }, []);

  return {
    sites, site, activeId: site.id, ready, fresh, status, blocked, recovery,
    canUndo: past.length > 0, canRedo: future.length > 0,
    update, undo: () => step("undo"), redo: () => step("redo"),
    open, add, duplicate, remove, saveSnapshot, restoreSnapshot, dropSnapshot, importSites, acceptOverwrite,
  };
}
