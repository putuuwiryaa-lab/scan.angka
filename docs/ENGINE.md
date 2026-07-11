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

Movement Engine tidak memilih rumus A1–E9. Engine membentuk distribusi probabilitas digit berikutnya dari pergerakan historis.

### Alur

```txt
history_data
→ pisahkan AS/COP/KPL/EKR
→ bentuk digit, delta, arah, motif, dan jarak siklus
→ jalankan empat model
→ uji beberapa profil bobot secara walk-forward
→ pilih profil terbaik tanpa melihat final holdout
→ verifikasi pada final holdout
→ bentuk output live
```

### Model

1. **Transition** — membaca perpindahan digit dan delta sebelumnya.
2. **Motif** — membandingkan urutan gerakan terbaru dengan urutan historis.
3. **Cycle** — membaca jarak pengulangan digit.
4. **Cross-position** — membaca hubungan kondisi AS, COP, KPL, dan EKR.

Setiap model menghasilkan probabilitas digit 0–9 untuk setiap posisi. Distribusi digabungkan memakai profil bobot yang dipilih pada walk-forward.

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
BBFS 4D 8 digit   = 40,96% ≈ 41%
```

Hit rate dinilai bersama lift terhadap baseline, longest miss streak, stabilitas periode, dan final holdout.

## Walk-forward dan Holdout

Movement Engine membutuhkan minimal 80 result.

- Data sebelum validation menjadi training yang terus bertambah.
- Setiap baris validation diprediksi hanya dari data sebelumnya.
- Profil bobot dipilih dari validation.
- Final holdout tidak digunakan untuk memilih profil.
- Output tetap ditampilkan. Jika bukti belum stabil, kekuatan diberi label `PANTAU`.

## Pembentukan Output

Engine menguji seluruh kombinasi digit yang mungkin untuk jumlah digit pilihan.

- Posisi memaksimalkan probabilitas digit posisi berada dalam output.
- AI memaksimalkan probabilitas minimal satu posisi target tertutup.
- BBFS memaksimalkan probabilitas semua posisi target tertutup.

Karena ruang digit hanya 0–9, enumerasi kombinasi tetap kecil; maksimum `C(10,5) = 252` kombinasi.
