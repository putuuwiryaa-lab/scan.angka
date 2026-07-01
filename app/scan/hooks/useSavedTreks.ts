"use client";

import { useEffect, useMemo, useState } from "react";
import { SAVED_TREK_KEY } from "../constants";
import { buildSavedGroups } from "../helpers";
import type { SavedLive, SavedTrek } from "../types";

export function useSavedTreks(marketId: string, latestResult?: string | null) {
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [savedLiveMap, setSavedLiveMap] = useState<Record<string, SavedLive>>({});
  const [savedFlashId, setSavedFlashId] = useState("");

  const savedTreksForMarket = useMemo(() => savedTreks.filter((item) => item.marketId === marketId), [savedTreks, marketId]);
  const savedGroups = useMemo(() => buildSavedGroups(savedTreksForMarket), [savedTreksForMarket]);
  const savedRefreshKey = useMemo(() => `${marketId}:${latestResult ?? ""}:${savedTreksForMarket.map((item) => `${item.id}:${item.L}:${item.kolomHidup.join("")}`).join("|")}`, [marketId, latestResult, savedTreksForMarket]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_TREK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSavedTreks(parsed.filter((item) => item?.kolomHidup?.length && item?.L).slice(0, 50));
    } catch {
      setSavedTreks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (savedTreksForMarket.length === 0) return;

    async function refreshSavedTreks() {
      const updates: Record<string, SavedLive> = {};
      await Promise.all(savedTreksForMarket.map(async (saved) => {
        try {
          const response = await fetch("/api/saved-trek", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              marketId: saved.marketId,
              formula: saved.formula,
              scanMode: saved.scanMode,
              targetPos: saved.targetPos,
              target2D: saved.target2D,
              L: saved.L,
              kolomHidup: saved.kolomHidup,
            }),
          });
          const data = await response.json();
          if (!data.error) updates[saved.id] = data;
        } catch {
          // Tetap pakai snapshot tersimpan jika refresh gagal.
        }
      }));
      if (!cancelled && Object.keys(updates).length) setSavedLiveMap((current) => ({ ...current, ...updates }));
    }

    refreshSavedTreks();
    return () => { cancelled = true; };
  }, [savedRefreshKey]);

  function persistSavedTreks(next: SavedTrek[]) {
    setSavedTreks(next);
    try { localStorage.setItem(SAVED_TREK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function deleteSavedTrek(id: string) {
    persistSavedTreks(savedTreks.filter((item) => item.id !== id));
    setSavedLiveMap((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  return {
    savedTreks,
    savedTreksForMarket,
    savedGroups,
    savedLiveMap,
    savedFlashId,
    setSavedFlashId,
    persistSavedTreks,
    deleteSavedTrek,
  };
}
