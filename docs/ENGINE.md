# Engine Scan Angka

Project memiliki dua jalur analisa: **Scan Engine** dan **Movement Engine**.

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

## Movement Engine

Movement Engine tidak memilih rumus A1–E9. Engine membandingkan metode pembaca pergerakan pada **14 result terbaru** dan memilih kombinasi metode × window dengan kemenangan tertinggi.

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
- lift terhadap baseline;
- kestabilan window tetangga.

## Metode yang Diuji

1. **Delta** — membaca perpindahan digit dan dua delta terakhir.
2. **Motif** — mencari urutan gerakan historis yang mirip dengan kondisi terbaru.
3. **Cycle** — membaca jarak pengulangan dan tekanan kemunculan digit.
4. **Cross-position** — membaca hubungan kondisi AS, COP, KPL, dan EKR.
5. **Joint Pair** — khusus target 2D; membentuk probabilitas pasangan 00–99 secara langsung.

Untuk target satu posisi, 3D, dan 4D, Joint Pair tidak ikut turnamen. Untuk target 2D, semua lima metode diuji.

Dengan 168 data:

```txt
Posisi / 3D / 4D = 4 metode × 11 window = 44 kandidat
Target 2D        = 5 metode × 11 window = 55 kandidat
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
Delta W28 = 11/14
Delta W42 = 12/14
Delta W56 = 11/14
```

W42 lebih didukung dibanding nilai tinggi yang berdiri sendiri di antara window lemah.

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

Saat result baru masuk, L14 bergeser satu langkah dan seluruh turnamen dijalankan ulang.

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

## Baseline Teoretis

Untuk `k` digit output dan `m` posisi target:

```txt
Posisi = k / 10
AI     = 1 - (1 - k/10)^m
BBFS   = (k/10)^m
```

Contoh:

```txt
KPL 7 digit       = 70%
AI 2D 4 digit     = 64%
BBFS 2D 8 digit   = 64%
BBFS 4D 8 digit   = 40,96% ≈ 41%
```

## Batas Penerbitan

Pemenang tidak otomatis diterbitkan. Minimal KENA dihitung satu tingkat di atas ekspektasi baseline L14.

Contoh:

```txt
KPL 7 digit       → minimal 11/14
AI 2D 4 digit     → minimal 10/14
BBFS 2D 8 digit   → minimal 10/14
BBFS 4D 8 digit   → minimal 7/14
```

Jika seluruh metode berada di bawah batas tersebut, engine tetap menampilkan hasil turnamen tetapi **tidak menerbitkan angka rekomendasi**.

## Pembentukan Output

Engine menguji seluruh kombinasi digit yang mungkin untuk jumlah digit pilihan.

- Posisi memaksimalkan probabilitas digit posisi berada dalam output.
- AI memaksimalkan probabilitas minimal satu posisi target tertutup.
- BBFS memaksimalkan probabilitas semua posisi target tertutup.
- Joint Pair menilai pasangan 00–99 langsung, bukan sekadar mengalikan ranking KPL dan EKR.

Karena ruang digit hanya 0–9, enumerasi kombinasi tetap kecil; maksimum `C(10,5) = 252` kombinasi.
