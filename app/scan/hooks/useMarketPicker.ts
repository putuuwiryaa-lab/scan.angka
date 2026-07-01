"use client";

import { useEffect, useMemo, useState } from "react";
import { formatSyncTime, isSingapore, marketTitle } from "../helpers";
import type { Market } from "../types";

export function useMarketPicker() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [syncUpdatedAt, setSyncUpdatedAt] = useState<string | null>(null);
  const [marketError, setMarketError] = useState("");

  const selectedMarket = useMemo(() => markets.find((market) => market.id === marketId) ?? null, [markets, marketId]);
  const filteredMarkets = useMemo(() => {
    const query = marketQuery.trim().toLowerCase();
    if (!query) return markets.slice(0, 30);
    return markets.filter((market) => marketTitle(market).toLowerCase().includes(query)).slice(0, 30);
  }, [markets, marketQuery]);
  const syncText = useMemo(() => formatSyncTime(syncUpdatedAt), [syncUpdatedAt]);

  useEffect(() => {
    fetch("/api/markets").then((response) => response.json()).then((data) => {
      if (data.error) return setMarketError(data.error);
      const list: Market[] = data.markets ?? [];
      setMarkets(list);
      setSyncUpdatedAt(data.syncUpdatedAt ?? null);
      const defaultMarket = list.find(isSingapore) ?? list[0];
      if (defaultMarket) setMarketId(defaultMarket.id);
    }).catch(() => setMarketError("Gagal memuat daftar pasaran."));
  }, []);

  function openMarket() {
    if (marketOpen) {
      setMarketOpen(false);
      return;
    }
    setMarketQuery("");
    setMarketOpen(true);
  }

  function selectMarket(market: Market) {
    setMarketId(market.id);
    setMarketQuery("");
    setMarketOpen(false);
  }

  return {
    markets,
    marketId,
    marketQuery,
    marketOpen,
    selectedMarket,
    filteredMarkets,
    syncText,
    marketError,
    setMarketId,
    setMarketQuery,
    setMarketOpen,
    openMarket,
    selectMarket,
  };
}
