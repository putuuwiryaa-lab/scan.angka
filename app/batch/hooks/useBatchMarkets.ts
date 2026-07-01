"use client";

import { useEffect, useMemo, useState } from "react";
import { MAX_BATCH_MARKETS } from "../constants";
import { batchMarketTitle } from "../helpers";
import type { Market } from "../../shared/types";

export function useBatchMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [marketError, setMarketError] = useState("");

  const filteredMarkets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter((market) => batchMarketTitle(market).toLowerCase().includes(needle));
  }, [markets, query]);

  useEffect(() => {
    fetch("/api/markets")
      .then((response) => response.json())
      .then((data) => {
        if (data.error) return setMarketError(data.error);
        setMarkets(data.markets ?? []);
      })
      .catch(() => setMarketError("Gagal memuat pasaran."));
  }, []);

  function toggleMarket(id: string) {
    setMarketError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_BATCH_MARKETS) {
        setMarketError(`Maksimal ${MAX_BATCH_MARKETS} pasaran per batch scan.`);
        return current;
      }
      return [...current, id];
    });
  }

  function selectAll() {
    setMarketError("");
    const ids = filteredMarkets.map((market) => market.id).slice(0, MAX_BATCH_MARKETS);
    setSelected(ids);
    if (filteredMarkets.length > MAX_BATCH_MARKETS) setMarketError(`Pilih Semua dibatasi ${MAX_BATCH_MARKETS} pasaran pertama.`);
  }

  function clearSelection() {
    setMarketError("");
    setSelected([]);
  }

  return {
    markets,
    selected,
    query,
    filteredMarkets,
    marketError,
    setQuery,
    toggleMarket,
    selectAll,
    clearSelection,
  };
}
