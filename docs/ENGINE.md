# Engine Scan Angka

Dokumen ini menjelaskan cara kerja singkat engine dan logic ranking yang dipakai aplikasi.

## Cara Kerja Singkat

1. Sistem membaca riwayat data angka dari kolom `history_data`.
2. Data diproses dari urutan lama ke baru.
3. Sistem menjalankan daftar rumus scan.
4. Rumus diuji menggunakan Data Uji yang dipilih.
5. Rumus yang lolos diproses ke ranking.
6. Output digit atau shio ditampilkan sesuai jumlah yang dipilih.
7. Untuk Batch Scan, proses yang sama dijalankan ke banyak pasaran sekaligus.

## Logic Ranking Engine

Engine memakai beberapa lapisan ranking agar hasil tidak sekadar mengambil rumus pertama yang lolos.

Urutan ranking utama:

1. Compression Ranking
2. Consensus Representative Ranking
3. Recent Score
4. Hit Score
5. Type Order
6. Urutan posisi dan rumus

## Compression Ranking

Rumus yang lolos pada jumlah digit pilihan akan diuji apakah masih bisa dipadatkan ke core yang lebih kecil.

Contoh:

```txt
User pilih 7D
Engine cek 7D
Lalu dicek apakah bisa tetap lolos di 6D atau 5D
```

Jika ada rumus yang tetap kuat saat dipadatkan, rumus tersebut akan diprioritaskan.

## Support Column Selection

Jika core lebih kecil dari jumlah digit display, sistem menambahkan support dari rumus yang sama.

Support tidak dipilih asal urutan A-J, tetapi berdasarkan alasan:

1. Menjembatani dua core kuat
2. Menempel ke core kuat
3. Punya hit sendiri pada rumus tersebut
4. Jika masih sama, memakai cadangan kolom yang tersedia

Metadata support yang tersedia di item scan:

```txt
coreSize
coreColumns
supportColumns
supportReasons
```

## Consensus Representative Ranking

Jika beberapa rumus setara dan tidak ada yang lebih unggul dari sisi compression, sistem membuat frekuensi digit dari kelompok rumus setara.

Contoh:

```txt
User pilih 7D
Engine mengambil top 7 frekuensi dari rumus-rumus yang setara
Lalu memilih rumus yang paling mewakili top 7 tersebut
```

Untuk AI 4D, sistem memakai top 4. Untuk 5D memakai top 5, dan seterusnya.

Metadata consensus yang tersedia:

```txt
consensusDigits
consensusOverlap
consensusWeight
```

## Mode Target

Kode posisi utama:

```txt
A = AS
C = COP/KOP
K = KPL/kepala
E = EKR/ekor
```

Target 2D:

```txt
depan    = A,C
tengah   = C,K
belakang = K,E
```

Mode shio memakai target 2D untuk membentuk nilai 2D, lalu dikonversi ke index shio.
