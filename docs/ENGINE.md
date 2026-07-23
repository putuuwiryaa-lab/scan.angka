# Engine Scan Angka

Project memiliki dua jalur analisa: **Scan Engine** dan **Adaptive Movement Engine**.

## Scan Engine

Scan Engine menjalankan kumpulan rumus terhadap riwayat data, memilih kolom yang lolos Data Uji, lalu melakukan ranking berdasarkan recent score, hit score, dan consensus.

Kode posisi:

```txt
A = AS
C = COP
K = KPL
E = EKR
```

Target 2D:

```txt
depan    = A,C
tengah   = C,K
belakang = K,E
```

## Adaptive Movement Engine

Engine tidak memilih rumus A1–E9. Engine membandingkan beragam model pembaca pergerakan pada **14 result terbaru** dan memilih kombinasi metode × window dengan kemenangan tertinggi.

Setiap konfigurasi yang memiliki data minimum ikut dalam turnamen. Konfigurasi dengan ranking tertinggi selalu dipakai untuk membentuk output berikutnya.

## Struktur Data 168 Result

Jika tersedia 168 result:

```txt
Data 1–154   = sumber training
Data 155–168 = walk-forward tetap L14
Data 169     = target prediksi berikutnya
```

Window training selalu kelipatan 14:

```txt
W14, W28, W42, W56, W70, W84,
W98, W112, W126, W140, W154
```

## Walk-forward L14

Contoh Delta W28:

```txt
Prediksi data 155 → training data 127–154
Prediksi data 156 → training data 128–155
Prediksi data 157 → training data 129–156
...
Prediksi data 168 → training data 140–167
```

Target yang sedang diuji tidak pernah ikut masuk ke training.

Setelah 14 pengujian selesai, engine mencatat:

- jumlah KENA dari 14;
- KENA pada 7 result terbaru;
- KENA pada 3 result terbaru;
- longest miss streak;
- kestabilan window tetangga;
- rata-rata probabilitas output.

## Metode yang Diuji

### Model umum

1. **Delta Movement** — membaca perpindahan digit dan dua delta terakhir.
2. **Pattern Motif** — mencari urutan gerakan historis yang mirip dengan kondisi terbaru.
3. **Cycle Analysis** — membaca jarak pengulangan dan tekanan kemunculan digit.
4. **Cross Position** — membaca hubungan kondisi AS, COP, KPL, dan EKR.
5. **Momentum Decay** — memprioritaskan pola terbaru menggunakan pembobotan waktu menurun.
6. **Transition Matrix** — membaca transisi arah gerak menuju arah berikutnya.
7. **Regime Adaptive** — menyesuaikan komposisi model saat kondisi trend, zigzag, reversal, stabil, atau chaotic.
8. **Consensus Ensemble** — menggabungkan model-model umum berdasarkan tingkat informasi distribusinya.
9. **Walk-Forward Weighted Ensemble** — memperbarui bobot model dasar dari hasil walk-forward sebelumnya tanpa melihat target yang sedang diuji.

### Model khusus target 2D

10. **Joint Pair** — membentuk probabilitas pasangan 00–99 dari kemiripan state dan movement.

Metode berbasis Markov tidak digunakan di Adaptive Engine.

Untuk target satu posisi, 3D, dan 4D, engine menguji 9 model umum. Untuk target 2D, Joint Pair ikut ditambahkan.

Dengan 168 data:

```txt
Posisi / 3D / 4D = 9 metode × 11 window = 99 kandidat
Target 2D        = 10 metode × 11 window = 110 kandidat
```

## Ranking Kandidat

Kandidat diurutkan berdasarkan:

1. KENA L14 tertinggi;
2. KENA L7 tertinggi;
3. miss streak terpendek;
4. KENA L3 tertinggi;
5. rata-rata kemenangan window tetangga;
6. rata-rata probabilitas output;
7. window lebih panjang jika seluruh nilai masih sama.

Contoh stabilitas:

```txt
Momentum Decay W28 = 11/14
Momentum Decay W42 = 12/14
Momentum Decay W56 = 11/14
```

W42 lebih didukung dibanding nilai tinggi yang berdiri sendiri di antara window lemah.

## Pemecah Seri

Turnamen awal memakai L14. Bila beberapa konfigurasi memiliki jumlah KENA tertinggi yang sama, seluruh kandidat diuji ulang secara progresif pada L21, L28, L35, dan seterusnya selama riwayat masih mencukupi.

Jika satu kandidat menjadi pemimpin tunggal, kandidat tersebut dipilih. Jika seri bertahan sampai batas riwayat, ranking sekunder digunakan sebagai pemutus akhir.

## Prediksi Berikutnya

Setelah pemenang dipilih, metode tersebut dilatih ulang memakai window terbaru.

Contoh pemenang:

```txt
Joint Pair W98 = 12/14
```

Prediksi result ke-169 menggunakan:

```txt
98 data terbaru dari data 71–168
```

Saat result baru masuk, L14 bergeser satu langkah dan seluruh turnamen dijalankan ulang. Metode terpilih dapat berubah mengikuti kondisi data terbaru.

Output selalu diterbitkan selama tersedia minimal 28 result. Validasi, confidence, kualitas sinyal, dan audit berfungsi sebagai informasi evaluasi, bukan gerbang penerbitan.

## Prediction Ledger Live

Setiap hasil yang benar-benar diterbitkan melalui halaman Adaptif atau Batch Adaptif disimpan ke tabel `adaptive_predictions` sebagai prediksi `pending`.

Ledger mencatat:

- pasaran dan result sumber;
- ukuran histori saat prediksi dibuat;
- jenis output, target, dan jumlah digit;
- digit hasil, metode, dan window terpilih;
- validasi L14 dan validasi pemilihan;
- confidence, kualitas sinyal, regime, dan probabilitas digit.

`prediction_key` bersifat unik. Menjalankan konfigurasi yang sama berulang kali pada histori yang sama tidak menambah baris prediksi baru.

Saat pasaran tersebut diproses lagi setelah result baru masuk, seluruh prediksi pending dinilai hanya terhadap **result pertama setelah histori sumber**:

```txt
source_history_size = 168
actual_result       = data ke-169
```

Jika histori lama berubah sehingga result sumber tidak lagi cocok, prediksi ditandai `invalidated` dan tidak dihitung sebagai hit atau miss. Hal ini mencegah revisi histori menghasilkan evaluasi live yang salah.

Rekap observasi tersedia melalui:

```txt
GET /api/adaptive-ledger
GET /api/adaptive-ledger?marketId=<id>
```

Endpoint menampilkan pending, invalidated, total settled, hit, miss, hit rate, current miss streak, performa per pasaran, serta performa per metode × window. Ledger hanya mengukur performa live; pada tahap ini nilainya belum mengubah pemilihan model.

## Objektif Output

### Posisi

```ts
covered = outputDigits.includes(nextPositionDigit)
```

### AI

AI cukup menangkap minimal satu digit target.

```ts
covered = targetDigits.some((digit) => outputDigits.includes(digit))
```

### BBFS

BBFS wajib menutup semua digit target.

```ts
covered = uniqueTargetDigits.every((digit) => outputDigits.includes(digit))
```

Digit kembar tidak perlu tersedia dua kali karena output adalah kumpulan digit.

## Pembentukan Output

Engine menguji seluruh kombinasi digit yang mungkin untuk jumlah digit pilihan.

- Posisi memaksimalkan probabilitas digit posisi berada dalam output.
- AI memaksimalkan probabilitas minimal satu posisi target tertutup.
- BBFS memaksimalkan probabilitas semua posisi target tertutup.
- Joint Pair menilai pasangan 00–99 secara langsung.

Karena ruang digit hanya 0–9, enumerasi kombinasi tetap kecil; maksimum `C(10,5) = 252` kombinasi.

## Catatan Validasi

Penambahan metode memperluas variasi pembacaan, tetapi juga memperbesar peluang satu kandidat terlihat unggul secara kebetulan. Karena itu L7, miss streak, stabilitas window tetangga, dan pemecah seri tetap dipertahankan. Metode baru tidak otomatis dianggap lebih baik; semuanya harus menang pada walk-forward yang sama.
