# Adaptive Chance Benchmark

Tahap 4 menambahkan benchmark peluang acak untuk setiap prediksi Adaptive Movement yang sudah `settled`.

Benchmark ini hanya alat audit. Nilainya tidak pernah:

- menyembunyikan digit hasil;
- membatalkan prediksi;
- menahan publikasi;
- menghasilkan status layak atau tidak layak;
- mengubah metode, window, probabilitas, atau digit engine.

## Model

Versi model:

```text
conditional-combinatorial-v1
```

Benchmark menjawab pertanyaan berikut:

> Bila `digit_count` digit unik dipilih secara seragam dari digit 0–9, berapa probabilitas pilihan tersebut memenuhi objektif terhadap result aktual yang sama?

Perhitungan bersifat kondisional terhadap jumlah digit target unik pada result aktual. Ini penting karena target seperti `66` tidak identik dengan target `67`.

### Posisi

Untuk output Posisi dengan `d` digit:

```text
P(hit) = d / 10
```

### AI

AI dinyatakan hit bila minimal satu digit target tercakup. Dengan `u` digit target unik:

```text
P(hit) = 1 - C(10-u, d) / C(10, d)
```

### BBFS

BBFS dinyatakan hit bila seluruh digit target unik tercakup:

```text
P(hit) = C(10-u, d-u) / C(10, d)
```

Nilainya nol ketika `d < u`.

## Penyimpanan

Kolom settlement baru pada `adaptive_predictions`:

- `chance_probability`
- `chance_unique_target_count`
- `chance_model_version`
- `chance_benchmarked_at`

Trigger database mengisi kolom tersebut ketika prediction berubah menjadi `settled`. Migration juga melakukan backfill terhadap prediction settled lama.

## Endpoint

Endpoint tetap:

```text
GET /api/adaptive-ledger
GET /api/adaptive-ledger?marketId=<id>
```

Setiap summary sekarang memiliki objek `chance`:

```json
{
  "sampleSize": 20,
  "observedHits": 15,
  "observedHitRate": 75,
  "expectedHits": 13.2,
  "expectedHitRate": 66,
  "edgeHits": 1.8,
  "edgePoints": 9
}
```

Makna field:

- `expectedHits`: jumlah hit yang secara matematis diharapkan dari pilihan acak dengan konfigurasi sama;
- `edgeHits`: observed hits dikurangi expected hits;
- `edgePoints`: observed hit rate dikurangi expected hit rate dalam percentage points.

Summary tersedia untuk:

- keseluruhan sample;
- per pasaran;
- per metode dan window terpilih;
- per konfigurasi lengkap.

## Interpretasi

Edge positif tidak otomatis membuktikan predictive edge. Prediction antar-konfigurasi dan antar-result dapat saling berkorelasi. Tahap ini tidak menghitung klaim signifikansi statistik dan tidak menggunakan benchmark sebagai release gate.

Outer walk-forward dan evaluasi holdout pada tahap berikutnya diperlukan sebelum membuat kesimpulan yang lebih kuat.
