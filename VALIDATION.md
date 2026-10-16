# Catatan validasi Searah

Tanggal: 16 Oktober 2026.

## Hasil

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run check` | Lulus — 0 error, 0 warning Svelte/TypeScript |
| `npm test` | Lulus — 5 unit test |
| `npm run build` | Lulus — output adapter Cloudflare di `.svelte-kit/cloudflare` |
| `npm run test:integration` | Lulus — 14 skenario pada Worker produksi hasil build dan D1 sementara |
| Setup lokal | Lulus — migrasi diterapkan ke D1 lokal |
| Seed lokal | Lulus — akun dan jadwal contoh tersimpan di D1 lokal |

Check, unit tests, build, dan integration tests selesai dengan exit code 0 pada pembaruan ini. `npm run verify` tersedia untuk menjalankan semuanya secara berurutan.

## Tambahan pada pembaruan username

- Tiga akun baru berhasil didaftarkan tanpa field email; nilainya NULL, tanpa alamat email pengganti.
- Username unik tanpa membedakan huruf besar/kecil. Input dengan spasi atau format tidak valid ditolak; login dengan huruf besar/kecil dan spasi tepi dinormalisasi.
- Email opsional berhasil ditambahkan, divalidasi, disimpan, dan dihapus lewat profil. Email duplikat ditolak tanpa mengubah akun; email kosong pada banyak akun tetap diperbolehkan.
- Data dengan skema lama dimasukkan sebelum migrasi: akun, hash password, sesi, jadwal, peserta, checklist, dan pesan. Semuanya bertahan setelah migrasi `0002`, dan pemeriksaan foreign key tidak menemukan pelanggaran.
- Cookie sesi lama tetap valid. Login email akun lama berfungsi sampai username dipilih; setelah itu login memakai username, termasuk setelah email dikosongkan. Hash password tidak berubah selama migrasi/pemilihan username.

## Skenario integrasi

1. Pengguna tanpa sesi tidak bisa mengubah data; request dari origin lain ditolak.
2. Pendaftaran akun menghasilkan cookie HttpOnly, Secure di HTTPS, dan SameSite=Lax; API tidak mengembalikan hash password.
3. Pembuatan gowes memasukkan penyelenggara sebagai peserta secara atomik; pengguna lain tidak dapat mengubah/menghapus jadwal.
4. Dua pendaftaran bersamaan untuk satu tempat tersisa menghasilkan satu keberhasilan dan satu penolakan. Kuota tidak terlampaui.
5. Checklist pribadi tersimpan per akun; pengguna yang belum ikut tidak bisa menulis obrolan; hak hapus pesan diperiksa server.
6. Trigger D1 menolak pengurangan kuota di bawah jumlah peserta; batal ikut melepas kursi dan menghapus checklist terkait.
7. Profil tetap tersimpan; ganti password mencabut sesi perangkat lain. Password dengan spasi awal/akhir tetap dapat dipakai login.
8. Pembatalan menutup pendaftaran; penghapusan jadwal menghapus data peserta terkait.
9. Setelah waktu berangkat lewat, pendaftaran ditutup. Penyelenggara dapat menandai perjalanan selesai; jadwal selesai tidak dapat diubah.
10. Logout mencabut sesi di database; terlalu banyak percobaan login menghasilkan HTTP 429.

Unit test juga memeriksa salt password yang berbeda, pepper yang salah, URL rute tidak aman, waktu WIB melewati tengah malam UTC, dan escaping/folding Unicode pada ekspor kalender.

## Versi yang diuji

- Node.js 24.19.0
- Svelte 5.57.2
- SvelteKit 2.70.3
- Tailwind CSS 4.3.3
- Vite 7.3.7
- Adapter Cloudflare 5.1.0
- Wrangler 4.151.0
- Runtime Miniflare 5.20261012.0-beta, sesuai dependensi Wrangler yang digunakan

Versi instalasi dikunci melalui `package-lock.json`.

## Batas verifikasi

Belum dilakukan pengujian visual/interaksi langsung di browser atau deployment ke akun Cloudflare pengguna. Integrasi diuji dengan runtime Worker lokal; kuota CPU/permintaan paket Cloudflare produksi belum diuji. Verifikasi browser setelah menjalankan lokal: buat akun, ubah ukuran jendela, buka kalender dan dialog, buat jadwal, lalu coba ikut dari akun kedua.

Pembaruan dikirim sebagai patch untuk source repository yang sudah ada. Patch tidak mengubah `wrangler.jsonc`, database ID, `AUTH_SECRET`, `.git`, dependensi, atau migrasi pertama. Panduan pemasangan ada di `UPDATE_USERNAME.md`. Database produksi baru berubah setelah pengguna menjalankan migrasi remote sendiri.
