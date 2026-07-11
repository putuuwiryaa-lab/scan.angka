# Struktur Project

Dokumen ini menjelaskan folder penting dan file utama di project Scan Angka.

## Struktur Folder Penting

```txt
app/
  api/
    movement/
      route.ts
    scan/
      route.ts
    batch-scan/
      route.ts
    markets/
      route.ts
    saved-trek/
      route.ts
  movement/
    components/
      MovementSelectSheet.tsx
    movement.module.css
    page.tsx
    useMovementRunner.ts
  batch/
    components/
    hooks/
    page.tsx
  scan/
    components/
    hooks/
    constants.ts
    helpers.ts
    types.ts
  shared/
  styles/
  bottom-nav.tsx
  globals.css
  layout.tsx
  page.tsx

lib/
  engine/
    runner.ts
    ranking.ts
    formulas.ts
    helpers.ts
    history.ts
    types.ts
  movement/
    engine.ts
    evaluator.ts
    helpers.ts
    models.ts
    optimizer.ts
    types.ts
  server/
  shared/

scripts/
  movement-invariants.ts

public/
  icon-192.png
  icon-512.png
  icon.svg
  sw.js
```

## File Utama

| File | Fungsi |
| --- | --- |
| `app/page.tsx` | Halaman scan satu pasaran |
| `app/movement/page.tsx` | UI Movement Engine |
| `app/movement/useMovementRunner.ts` | Request analisa Movement |
| `app/api/movement/route.ts` | API Movement Engine |
| `app/batch/page.tsx` | Halaman Batch Scan |
| `app/api/scan/route.ts` | API scan satu pasaran |
| `app/api/batch-scan/route.ts` | API batch scan |
| `lib/engine/runner.ts` | Orkestrasi Scan Engine |
| `lib/engine/ranking.ts` | Ranking hasil scan |
| `lib/movement/models.ts` | Transition, motif, cycle, dan cross-position |
| `lib/movement/evaluator.ts` | Walk-forward, pemilihan bobot, dan holdout |
| `lib/movement/optimizer.ts` | Optimasi kombinasi output Posisi/AI/BBFS |
| `lib/movement/engine.ts` | Orkestrasi dan hasil Movement Engine |
| `scripts/movement-invariants.ts` | Pengujian aturan AI, BBFS, baseline, dan ukuran output |
| `app/bottom-nav.tsx` | Navigasi Scan, Prediksi, dan Batch |

## Pemisahan Tanggung Jawab

- `lib/engine/` tetap menangani scan rumus dan trek.
- `lib/movement/` khusus membaca pergerakan dan memprediksi distribusi digit.
- `app/movement/` hanya menangani UI dan request API.
- Riwayat pasaran tetap dibaca server-side dari Supabase.
