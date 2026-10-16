# Searah — Gowes bareng, lebih terencana

Website planner gowes berbahasa Indonesia dengan **Svelte 5, SvelteKit 2, Tailwind CSS 4, TypeScript, dan Cloudflare D1 (SQL)**. Frontend, API, dan autentikasi berada dalam satu proyek. Siap dicoba di komputer sendiri dan disambungkan ke GitHub → Cloudflare Pages.

Desain krem, hijau gelap, dan lime; responsif untuk desktop maupun ponsel. Font memakai font sistem, ilustrasi SVG tersedia di source, dan aplikasi tidak memerlukan API peta berbayar.

## 1. Coba di PC

Gunakan **Node.js 24 LTS** (minimal 22.12) dan npm. Perintah berikut juga bisa dipakai di Fish.

Ekstrak ZIP, buka terminal di folder `gowes-bareng`, lalu:

```sh
npm ci
npm run dev
```

Buka **http://127.0.0.1:5173**. Jika port digunakan aplikasi lain, Vite akan menampilkan port penggantinya.

Saat `npm run dev` pertama kali dijalankan, proyek otomatis:

1. Membuat `.dev.vars` dengan `AUTH_SECRET` acak untuk komputer kamu.
2. Menerapkan migrasi SQL ke database D1 lokal.
3. Menjalankan Vite beserta emulasi binding Cloudflare.

Tidak perlu login Cloudflare, memasang Docker, atau membuat akun layanan database untuk mencoba secara lokal. Internet dibutuhkan untuk mengunduh dependensi saat instalasi pertama.

Klik **Buat akun**, masukkan nama, email, dan password minimal 12 karakter. Akun dan data langsung disimpan di database lokal. Email berfungsi sebagai identitas login; proyek ini belum mengirim email verifikasi.

**Database lokal tetap ada setelah server dimatikan** di `.wrangler/state`. Folder ini bukan bagian source yang di-push ke GitHub. Data lokal dan produksi adalah dua database terpisah; deploy tidak memindahkan akun atau jadwal lokal.

### Dua cara mencoba data contoh

- **Jelajahi tampilan demo** di halaman masuk: data contoh di memori browser, tanpa membuat akun. Mode ini untuk melihat tampilan dan tidak menyimpan perubahan. Reload mengakhiri demo.
- Untuk mencoba CRUD, login, diskusi, dan checklist dengan data contoh sungguhan di D1 lokal:

```sh
npm run db:seed
npm run dev
```

| Akun contoh lokal | Nilai |
| --- | --- |
| Email | `demo@searah.local` |
| Password | `GowesBareng!2026` |

Seed hanya mengakses database lokal melalui `getPlatformProxy`, membuat empat jadwal contoh mendatang dan tiga akun contoh, serta bisa dijalankan ulang. Jadwal contoh yang sudah ada tidak diubah; password akun contoh diatur ulang saat seed dijalankan. Jangan gunakan kredensial contoh untuk akun pribadi.

## 2. Fitur

| Area | Kemampuan |
| --- | --- |
| Akun | Daftar, masuk, keluar, ganti password, sesi 14 hari |
| Dashboard | Gowes berikutnya, agenda pribadi, jumlah gowes dan jarak perjalanan selesai |
| Jelajahi | Pencarian judul/kota/penyelenggara; filter pace, medan, dan status |
| Rencana gowes | Buat, ubah, batalkan, tandai selesai, dan hapus |
| Detail | Titik kumpul, tanggal/jam, jarak, elevasi, pace, medan, kuota, catatan, tautan rute |
| Peserta | Ikut/batal ikut; penyelenggara otomatis terdaftar |
| Kalender | Tampilan bulanan untuk gowes yang kamu ikuti; ekspor `.ics` |
| Persiapan | Checklist pribadi yang tersimpan terpisah untuk setiap peserta dan gowes |
| Obrolan | Peserta mengirim pesan; penulis atau penyelenggara dapat menghapusnya |
| Profil | Nama, kota, jenis sepeda, bio |
| Bagikan | Salin tautan detail; teman perlu masuk agar bisa melihatnya |

Semua akun yang masuk bisa menemukan seluruh jadwal di komunitas ini. Saat ini belum ada grup privat atau undangan khusus.

**Aturan perjalanan:**

- Waktu input dan tampilan memakai **WIB (Asia/Jakarta)**, termasuk saat zona waktu komputer berbeda. Database menyimpan waktu UTC.
- Kuota 2–200 orang, sudah termasuk penyelenggara. Trigger SQL mengunci validasi kursi terakhir agar dua permintaan bersamaan tidak melampaui kuota.
- Peserta bisa membatalkan keikutsertaan sebelum berangkat. Penyelenggara menutup seluruh gowes melalui aksi Batalkan.
- Jadwal yang dibatalkan atau selesai tidak menerima peserta baru. Setelah waktu keberangkatan lewat, pendaftaran ditutup.
- Penyelenggara bisa menandai selesai setelah waktu keberangkatan lewat. Statistik memakai **jarak rencana**, bukan GPS atau rekaman olahraga.
- Menghapus jadwal juga menghapus peserta, checklist, dan obrolannya. UI meminta konfirmasi.
- Ilustrasi pada kartu adalah ilustrasi perjalanan, **bukan peta navigasi**. Tautan rute diisi sendiri.
- Waktu selesai dalam file kalender adalah estimasi dari jarak dan pace.
- Daftar memuat maksimal 300 jadwal terbaru. Pesan detail memuat maksimal 100 pesan terbaru. Pagination bisa ditambahkan jika komunitas berkembang.

## 3. Push ke GitHub sendiri

Buat repository kosong di akun GitHub kamu, lalu jalankan dari folder proyek:

```sh
git init
git add .
git commit -m "Build Searah cycling planner"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Ganti `USERNAME/NAMA-REPO` dengan repository kamu. `.gitignore` sudah mengecualikan `node_modules`, build, database lokal, `.dev.vars`, dan file `.env`.

`package-lock.json` sengaja disertakan agar instalasi bisa direproduksi dengan `npm ci`.

## 4. Pasang database produksi di Cloudflare

Setelah tes lokal selesai, login ke akun Cloudflare kamu:

```sh
npx wrangler login
npx wrangler d1 create gowes-bareng-db
```

Salin `database_id` dari hasil perintah. Buka `wrangler.jsonc`, lalu ganti UUID nol:

```json
{
  "binding": "DB",
  "database_name": "gowes-bareng-db",
  "database_id": "UUID-DARI-CLOUDFLARE-KAMU",
  "preview_database_id": "DB",
  "migrations_dir": "migrations"
}
```

Pertahankan nama binding **`DB`**. `preview_database_id: "DB"` dipakai untuk pengembangan Pages lokal.

Terapkan skema ke database produksi:

```sh
npm run db:migrate:remote
```

Perintah ini menggunakan `--remote` dan menulis ke D1 akun kamu. Migrasi hanya membuat skema; tidak memasukkan akun contoh. Kamu perlu membuat akun baru di website produksi nanti.

Commit perubahan `wrangler.jsonc` dan push:

```sh
git add wrangler.jsonc
git commit -m "Configure Cloudflare D1 database"
git push
```

## 5. Deploy melalui Cloudflare Pages

Di dashboard Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**, lalu pilih repository tadi.

| Pengaturan | Nilai |
| --- | --- |
| Framework preset | SvelteKit |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `.svelte-kit/cloudflare` |
| Root directory | Kosong jika `package.json` di root repository |
| Node version | `24` (juga di `.node-version`) |
| Compatibility date | `2026-10-01` |
| Compatibility flag | `nodejs_compat` |
| D1 binding | `DB` → `gowes-bareng-db` |

`wrangler.jsonc` mendeklarasikan binding D1 dan konfigurasi runtime. Setelah database ID diisi, Cloudflare dapat membacanya dari repository. Jika dashboard meminta binding, pilih D1 yang sama dan gunakan nama `DB` persis.

### Tambahkan secret untuk login

Di terminal PC kamu, buat secret acak:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Di **Settings → Variables and Secrets** proyek Pages, tambahkan:

| Nama | Jenis | Isi |
| --- | --- | --- |
| `AUTH_SECRET` | Secret / encrypted | Hasil perintah acak di atas |

Jangan menaruh secret ini di repository. `.dev.vars` hanya untuk lokal dan tidak otomatis menjadi secret produksi. Jika secret baru ditambahkan setelah deploy pertama, lakukan **redeploy**. Login sengaja menampilkan pesan konfigurasi jika secret belum ada.

`AUTH_SECRET` adalah pepper untuk password. Simpan nilainya: menggantinya membuat password yang sudah tersimpan tidak dapat diverifikasi. Ganti secret dengan prosedur migrasi autentikasi jika aplikasi sudah dipakai orang lain.

Klik **Save and Deploy**. Setelah selesai, buka URL `*.pages.dev`, buat akun baru, buat satu jadwal, lalu tes login dan pendaftaran peserta dari akun/peramban lain. Push berikutnya ke `main` akan memicu build Pages otomatis.

Jangan menggunakan output `build/` atau adapter-static: login dan D1 membutuhkan runtime server yang dihasilkan adapter Cloudflare.

### Preview branch

Untuk percobaan branch/PR, pakai **database D1 terpisah dari produksi**, migrasikan skemanya, lalu atur binding dan `AUTH_SECRET` untuk environment preview. Jangan mengarahkan pengujian yang mengubah data ke D1 produksi. Aplikasi ini belum mengonfigurasi environment preview khusus secara otomatis.

## 6. Perintah proyek

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Setup database lokal lalu jalankan development server |
| `npm run db:seed` | Tambahkan akun dan jadwal contoh ke database lokal |
| `npm run check` | Periksa TypeScript, Svelte, dan aksesibilitas yang dikenali compiler |
| `npm test` | Uji password, validasi, zona waktu, dan ekspor kalender |
| `npm run build` | Build produksi dengan adapter Cloudflare |
| `npm run preview` | Jalankan hasil build melalui Wrangler Pages lokal |
| `npm run test:integration` | Uji Worker hasil build dan database D1 sementara |
| `npm run verify` | Check, unit tests, build, dan integration tests berurutan |
| `npm run db:migrate` | Terapkan migrasi SQL lokal |
| `npm run db:migrate:remote` | Terapkan migrasi SQL ke D1 produksi yang sudah dikonfigurasi |

Untuk `npm run preview`, jalankan `npm run dev` sekali untuk setup awal, hentikan dengan Ctrl+C, lalu `npm run build` dan `npm run preview`. URL preview akan dicetak oleh Wrangler. Preview juga menggunakan database lokal.

Pengujian integrasi tidak memerlukan akun Cloudflare dan memakai database sementara terpisah, sehingga tidak mengubah data di `.wrangler/state` atau produksi. Pengujian mencakup sesi cookie, akses API, kuota bersamaan, checklist, obrolan, profil, perubahan password, pembatalan, penghapusan, dan pembatasan login.

## 7. Struktur source

```text
src/
  lib/
    components/         Komponen dialog, ikon, ilustrasi, kartu gowes
    server/
      auth.ts           Hash password dan sesi
      api.ts            Alur autentikasi, planner, peserta, profil
      validation.ts     Validasi input server
    demo.ts             Data contoh untuk mode demo
    format.ts           Tanggal WIB dan ekspor kalender
    types.ts            Tipe data dan definisi checklist
  routes/
    +page.svelte        Antarmuka planner dan halaman akun
    +layout.svelte      Impor Tailwind dan CSS global
    api/[...path]/      Endpoint API SvelteKit
  hooks.server.ts       Pemeriksaan sesi, origin, dan header
  app.css               Tema, komponen, dan breakpoint responsif
migrations/             Skema SQL D1 yang dilacak Git
scripts/                Setup lokal, seed, migrasi remote, tes integrasi
tests/                  Pengujian unit
wrangler.jsonc          Binding database dan konfigurasi Pages
```

### Database

| Tabel | Isi |
| --- | --- |
| `users` | Profil dan hash password; email unik |
| `sessions` | Hash token sesi dan masa berlaku |
| `rides` | Jadwal, detail, kapasitas, dan status gowes |
| `participants` | Relasi peserta dengan gowes |
| `checklist` | Item siap per peserta dan gowes |
| `notes` | Obrolan peserta |
| `rate_limits` | Counter pembatasan login dan perubahan data |

Password di-hash dengan **scrypt N=16384, r=8, p=5**, salt acak per password, serta pepper server `AUTH_SECRET`. Token sesi acak disimpan di cookie HttpOnly dan hanya hash-nya di database. Cookie memakai Secure di HTTPS, SameSite=Lax, dan masa berlaku 14 hari. Mengganti password mencabut semua sesi lama dan membuat sesi baru pada perangkat yang dipakai.

API memeriksa origin untuk operasi yang mengubah data, memakai query berparameter, membatasi percobaan login, dan memeriksa kepemilikan jadwal di server. UI bukan satu-satunya tempat pembatasan akses. DB mempunyai foreign key, constraint, dan trigger kuota.

## 8. Penyesuaian dan batas fitur

- Nama dan copy: `src/routes/+page.svelte`; metadata: `<svelte:head>` dan `src/app.html`.
- Warna dan tata letak: `src/app.css`, variabel `--green`, `--lime`, dan `@theme`.
- Ilustrasi: `src/lib/components/RouteArt.svelte`; ikon/logo: `Icon.svelte` dan `static/favicon.svg`.
- Checklist: `src/lib/types.ts` serta constraint `checklist.item_id` di SQL. Untuk produksi yang sudah berjalan, tambahkan migrasi baru saat mengubah skema, jangan mengedit migrasi lama.

Fitur yang **belum diimplementasikan**: email verifikasi, reset password lewat email, OAuth/Google login, unggah foto, peta interaktif, rekaman GPS, grup privat, dan notifikasi WhatsApp/email/push. Tautan rute dan ekspor kalender sudah bisa dipakai tanpa integrasi tersebut.

Akun komunitas menggunakan email/password tanpa verifikasi email. Untuk komunitas publik besar, tambahkan verifikasi email, pemulihan password, dan pengendalian bot sesuai kebutuhan sebelum membuka pendaftaran secara luas. Kinerja password hashing di runtime lokal tidak membuktikan bahwa semua kuota CPU paket Cloudflare produksi akan tercukupi; periksa log runtime saat uji deploy.

Hasil pengujian source tersedia di `VALIDATION.md`. Deployment ke akun Cloudflare pribadi belum dilakukan dalam pembuatan proyek ini.

## 9. Jika ada kendala

| Gejala | Yang diperiksa |
| --- | --- |
| Database belum terhubung | Gunakan `npm run dev`; di Pages cek binding `DB` |
| `no such table` | Jalankan migrasi lokal/remote yang sesuai environment |
| `AUTH_SECRET belum diatur` | Lokal: pastikan `.dev.vars`; produksi: tambahkan secret lalu redeploy |
| `node:crypto` tidak didukung | Pastikan `nodejs_compat` dan compatibility date sesuai konfigurasi |
| Login dibatasi | Tunggu 15 menit setelah terlalu banyak percobaan |
| Data lokal tidak ada di situs | Database lokal dan produksi terpisah; buat akun dan jadwal di situs produksi |
| Jadwal tidak tampil di Mendatang | Cek waktu WIB, status, dan tab Semua |
| Port 5173 terpakai | Gunakan alamat yang dicetak Vite |
| Hash password tidak cocok setelah secret diganti | Kembalikan `AUTH_SECRET` yang semula digunakan |

## Referensi resmi

- [SvelteKit pada Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/)
- [Pengembangan lokal D1](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [Migrasi D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Tailwind CSS pada SvelteKit](https://tailwindcss.com/docs/installation/framework-guides/sveltekit)
- [Dukungan node:crypto Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)

Source proyek ini boleh kamu ubah dan push ke repository sendiri. Tidak ada akun cloud, credential GitHub, atau database produksi yang disertakan.
