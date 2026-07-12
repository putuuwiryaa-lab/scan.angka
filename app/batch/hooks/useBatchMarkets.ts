"use client";

import { useEffect, useMemo, useState } from "react";
import { MAX_BATCH_MARKETS } from "../constants";
import { batchMarketTitle } from "../helpers";
import type { Market } from "../../shared/types";

export function useBatchMarkets(maxMarkets = MAX_BATCH_MARKETS) {
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

  useEffect(() => {
    setSelected((current) => current.slice(0, maxMarkets));
  }, [maxMarkets]);

  function toggleMarket(id: string) {
    setMarketError("");
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxMarkets) {
        setMarketError(`Maksimal ${maxMarkets} pasaran untuk konfigurasi batch ini.`);
        return current;
      }
      return [...current, id];
    });
  }

  function selectAll() {
    setMarketError("");
    const ids = filteredMarkets.map((market) => market.id).slice(0, maxMarkets);
    setSelected(ids);
    if (filteredMarkets.length > maxMarkets) setMarketError(`Pilih Semua dibatasi ${maxMarkets} pasaran pertama.`);
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
