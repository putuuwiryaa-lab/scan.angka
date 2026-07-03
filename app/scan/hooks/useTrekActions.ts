"use client";

import { useMemo, useState } from "react";
import { clampTextNumber } from "../../shared/scan-utils";
import {
  buildCopyText,
  detailHeaderTitle,
  joinValues,
  labelsFromValues,
  pickColumns,
  predictionResult,
  predictionValues,
  savedSignature,
  scanDescription,
} from "../helpers";
import type { Market, SavedTrek, ScanItem, ScanResult } from "../types";

type Params = {
  marketId: string;
  marketName: string;
  selectedMarket: Market | null;
  result: ScanResult | null;
  rounds: string;
  digitCount: number;
  savedTreks: SavedTrek[];
  persistSavedTreks: (next: SavedTrek[]) => void;
  removeSavedTrek: (id: string) => void;
  setSavedFlashId: (id: string) => void;
  setActionError: (message: string) => void;
};

export function useTrekActions(params: Params) {
  const {
    marketId,
    marketName,
    selectedMarket,
    result,
    rounds,
    digitCount,
    savedTreks,
    persistSavedTreks,
    removeSavedTrek,
    setSavedFlashId,
    setActionError,
  } = params;
  const [viewItem, setViewItem] = useState<ScanItem | null>(null);
  const [viewSaved, setViewSaved] = useState<SavedTrek | null>(null);
  const [copied, setCopied] = useState(false);

  const viewRows = useMemo(() => viewItem?.result.rows ?? [], [viewItem]);
  const nextPrediction = viewItem ? predictionResult(viewItem) : "";
  const nextPredictionLabels = viewItem ? labelsFromValues(predictionValues(viewItem), viewItem.scanMode) : [];

  function resetTrekView() {
    setViewItem(null);
    setViewSaved(null);
    setCopied(false);
    setSavedFlashId("");
  }

  function openScanItem(item: ScanItem) {
    setCopied(false);
    setViewItem(item);
  }

  function saveTrek(item: ScanItem) {
    if (!marketId) return;
    const count = result?.config.digitCount ?? digitCount;
    const L = result?.config.L ?? clampTextNumber(rounds, 14, 1, 100);
    const title = detailHeaderTitle(marketName, selectedMarket);
    const prediction = pickColumns(item.kolomHidup, item.result.deretLive);
    const signature = savedSignature(item, marketId);
    const saved: SavedTrek = {
      id: signature,
      marketId,
      marketName: title,
      savedAt: new Date().toISOString(),
      savedLatestDraw: item.result.latestDraw,
      scanMode: item.scanMode,
      targetPos: item.targetPos,
      target2D: item.target2D,
      target3D: item.target3D,
      digitCount: count,
      L,
      formula: item.formula,
      kolomHidup: item.kolomHidup,
      activeColumns: item.activeColumns,
      predictionValues: prediction,
      predictionText: joinValues(prediction, item.scanMode),
      snapshotRows: item.result.rows,
    };
    const next = [saved, ...savedTreks.filter((savedItem) => savedItem.id !== signature)].slice(0, 50);
    persistSavedTreks(next);
    setSavedFlashId(signature);
    window.setTimeout(() => setSavedFlashId(""), 1200);
  }

  function deleteSavedTrek(id: string) {
    removeSavedTrek(id);
    if (viewSaved?.id === id) setViewSaved(null);
  }

  async function copyTrek() {
    if (!viewItem) return;
    const title = detailHeaderTitle(marketName, selectedMarket);
    const description = scanDescription(viewItem.scanMode, viewItem.targetPos, viewItem.target2D, result?.config.digitCount ?? digitCount, viewItem.target3D);
    const text = buildCopyText(viewItem, viewRows, nextPrediction, title, description);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setActionError("Gagal salin trek.");
    }
  }

  return {
    viewItem,
    viewSaved,
    copied,
    viewRows,
    nextPredictionLabels,
    setViewItem,
    setViewSaved,
    resetTrekView,
    openScanItem,
    saveTrek,
    deleteSavedTrek,
    copyTrek,
  };
}
