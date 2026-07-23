# Persistent Adaptive Live Weights

Tahap 3 membuat performa shadow candidate menjadi state persisten per:

- pasaran
- jenis output
- target
- jumlah digit
- metode
- training window

## Settlement dan decay

Setiap shadow candidate yang sudah memiliki `is_hit` diproses tepat satu kali melalui tabel idempotensi `adaptive_live_weight_events`.

Statistik diperbarui dengan exponential decay:

```text
decayed_hits  = previous_hits  × 0.97 + current_hit
decayed_total = previous_total × 0.97 + 1
```

`observations` tetap merupakan jumlah result live aktual tanpa decay.

## Cara memengaruhi output

Bobot live belum mengganti metode dan window pemenang turnamen. Tahap ini hanya memberi overlay probabilitas yang dibatasi:

- kurang dari 8 observasi: tidak aktif
- 8–41 observasi: aktif bertahap
- 42 observasi atau lebih: reliabilitas penuh
- kontribusi maksimum terhadap probabilitas akhir: 25%

Sumber overlay adalah seluruh metode dasar pada window yang dipilih. Bobot tiap sumber merupakan campuran antara hit rate walk-forward historis dan posterior hit rate live. Semakin banyak observasi live, semakin besar porsi posterior live.

Jika tabel atau fungsi Supabase belum tersedia, engine tetap menghasilkan output normal tanpa overlay.

## Alur request

```text
settle prediction pending
        ↓
refresh unprocessed shadow results
        ↓
load persistent weights untuk konfigurasi pasaran
        ↓
run tournament historis
        ↓
build shadow live outputs
        ↓
apply bounded live probability overlay
        ↓
record published prediction
```

## Pemeriksaan Supabase

```sql
select
  market_id,
  output_type,
  target,
  digit_count,
  method,
  "window",
  round(decayed_hits::numeric, 4) as decayed_hits,
  round(decayed_total::numeric, 4) as decayed_total,
  observations,
  case
    when decayed_total > 0
      then round(((decayed_hits + 1) / (decayed_total + 2))::numeric, 4)
    else null
  end as posterior_rate,
  last_result,
  updated_at
from public.adaptive_live_model_weights
order by updated_at desc, market_id, method, "window";
```

Pastikan tidak ada candidate yang diproses lebih dari sekali:

```sql
select
  candidate_id,
  count(*)
from public.adaptive_live_weight_events
group by candidate_id
having count(*) > 1;
```

Query tersebut harus menghasilkan nol baris.

## Batas tahap

Tahap 3 belum menggunakan live rate untuk mengganti ranking metode. Hal tersebut sengaja ditunda sampai jumlah observasi cukup dan benchmark peluang acak pada Tahap 4 tersedia.
