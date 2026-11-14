# Leaderboard Aldervane

Website leaderboard roleplay dengan database dan dashboard admin.

| Rank | Rentang poin |
| --- | --- |
| Knight of Aldervane | 200 – 3.249 |
| Sentinel of Aldervane | 3.250 – 7.499 |
| Praefect of Aldervane | 7.500+ |

**Alur kerjanya**

- Data pemain disimpan di database **Supabase** (PostgreSQL gratis).
- **Dashboard admin** (`/admin/`) dipakai untuk tambah/edit/hapus pemain, tambah/kurangi poin, impor CSV, dan melihat riwayat perubahan.
- **Leaderboard publik** (`/`) membaca database langsung dan menyegarkan diri tiap menit, jadi perubahan dari dashboard muncul tanpa build ulang.
- Website di-build dan di-host gratis lewat **GitHub Pages + GitHub Actions**.

Untuk keamanan, publik hanya menerima nama, poin, dan posisi. UID tidak pernah dikirim ke publik dan hanya dipakai untuk pencarian. Tabel pemain hanya bisa dibaca dan diubah oleh akun admin.

## 1. Siapkan database (Supabase)

1. Daftar di [supabase.com](https://supabase.com), lalu buat project baru.
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
3. Buka **Authentication → Users → Add user**, isi email dan password untuk akunmu (centang auto confirm jika ada).
4. Di SQL Editor, jalankan ini (ganti emailnya) agar akun tersebut menjadi admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'emailkamu@example.com';
   ```
5. Matikan pendaftaran publik: **Authentication → Sign In / Providers**, nonaktifkan opsi **Allow new users to sign up**. Tanpa ini, orang lain bisa membuat akun, walaupun mereka tetap tidak bisa menjadi admin.
6. Buka **Project Settings → API** dan catat **Project URL** serta **anon public key**.

## 2. Deploy ke GitHub Pages

1. Buat repository baru di GitHub dan upload seluruh isi folder ini ke branch `main`.
2. Di **Settings → Secrets and variables → Actions → New repository secret**, buat dua secret:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon public key
3. Di **Settings → Pages**, pada **Source** pilih **GitHub Actions**.
4. Push (atau jalankan workflow dari tab **Actions**). Hasilnya:
   - Leaderboard: `https://USERNAME.github.io/NAMA-REPO/`
   - Dashboard: `https://USERNAME.github.io/NAMA-REPO/admin/`

## Jalankan lokal

```bash
cp .env.example .env     # lalu isi URL dan anon key
npm install
npm run dev              # leaderboard di /, dashboard di /admin/
npm run build            # hasil build di folder dist
```

## Mengubah rentang rank

Ubah di dua tempat agar konsisten:
- `src/shared.js` (konstanta `RANKS`), untuk tampilan.
- `supabase/schema.sql` (fungsi `rank_of`), untuk perhitungan di database. Setelah diubah, jalankan ulang fungsi tersebut di SQL Editor.

## Catatan

- Memasukkan data otomatis dari bot atau game (misalnya bot Discord) bisa dilakukan lewat REST API Supabase memakai service role key. Simpan key itu hanya di sisi server dan jangan pernah dimasukkan ke repo atau website.
- Project Supabase gratis bisa dijeda jika lama tidak ada aktivitas. Kamu bisa mengaktifkannya lagi dari dashboard Supabase.
- Pencarian UID bisa dicoba berulang oleh siapa saja. Pakai UID yang tidak mudah ditebak (bukan 1, 2, 3, dst.) jika privasi poin penting.
