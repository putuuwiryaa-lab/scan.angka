# Struktur Project

Dokumen ini menjelaskan struktur folder penting dan file utama di project Scan Angka.

## Struktur Folder Penting

```txt
app/
  api/
    batch-scan/
      route.ts
    markets/
      route.ts
    saved-trek/
      route.ts
    scan/
      route.ts
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
    scan-options.ts
    scan-utils.ts
    types.ts
  styles/
    base.css
    batch.css
    form.css
    hero.css
    responsive.css
    results.css
    sheet.css
  globals.css
  layout.tsx
  manifest.ts
  page.tsx
  pwa-register.tsx

lib/
  engine/
    acke-engine.ts
    helpers.ts
    history.ts
    types.ts
  shared/
    columns.ts
    scan-mode.ts
  supabase/
    client.ts

public/
  icon-192.png
  icon-512.png
  icon.svg
  sw.js
```

## File Utama

| File | Fungsi |
| --- | --- |
| `app/page.tsx` | Halaman utama scan satu pasaran |
| `app/batch/page.tsx` | Halaman Batch Scan |
| `app/api/scan/route.ts` | API scan satu pasaran |
| `app/api/batch-scan/route.ts` | API batch scan |
| `app/api/markets/route.ts` | API daftar pasaran |
| `app/api/saved-trek/route.ts` | API refresh trek tersimpan |
| `app/scan/components/ScanControlPanel.tsx` | Form kontrol scan utama |
| `app/scan/components/ScanResultPanel.tsx` | Panel hasil scan utama |
| `app/scan/components/SavedTreksSection.tsx` | Panel trek tersimpan lintas market |
| `app/scan/hooks/useMarketPicker.ts` | State daftar/pilihan pasaran |
| `app/scan/hooks/useSavedTreks.ts` | State dan refresh trek tersimpan |
| `app/scan/hooks/useScanDropdowns.ts` | State dropdown aktif halaman scan |
| `app/scan/hooks/useScanRunner.ts` | Request scan satu pasaran |
| `app/scan/hooks/useTrekActions.ts` | Simpan, hapus, lihat, copy trek |
| `app/batch/hooks/useBatchMarkets.ts` | State pilihan market batch |
| `app/batch/hooks/useBatchRunner.ts` | Request batch scan |
| `lib/engine/acke-engine.ts` | Engine scan dan ranking |
| `lib/engine/helpers.ts` | Helper engine |
| `lib/engine/history.ts` | Validasi format data riwayat |
| `lib/engine/types.ts` | Tipe data engine |
| `lib/shared/columns.ts` | Konstanta kolom digit/shio canonical |
| `lib/shared/scan-mode.ts` | Scan mode dan helper mode canonical |
| `lib/supabase/client.ts` | Client Supabase |
| `app/manifest.ts` | Manifest PWA |
| `public/sw.js` | Service worker |

## Catatan Struktur

- `app/shared/` dipakai untuk helper/type UI yang digunakan lintas halaman.
- `lib/shared/` dipakai untuk konstanta dan helper canonical yang juga dipakai engine.
- `app/scan/helpers.ts` hanya untuk helper khusus tampilan/detail scan.
- `app/scan/constants.ts` hanya untuk konstanta UI scan dan re-export opsi umum.
