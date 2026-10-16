# Pembaruan: username dan email opsional

Pembaruan ini membuat pendaftaran cukup memakai **nama + username + password**. Email dapat ditambahkan, diubah, atau dihapus melalui **Profil saya**.

## Memasang patch pada proyek yang sudah berjalan

Patch dibuat dari source repository `AgungPixel/searah-gowes`, commit `20f2d99`. File konfigurasi Cloudflare, database ID, secret, database lokal, dan Git tidak diubah oleh patch ini. Dependensi juga tidak berubah.

1. Simpan `searah-username-update.patch` di folder proyek yang berisi `package.json`.
2. Dari terminal di folder tersebut, periksa dan terapkan:

```sh
git apply --check searah-username-update.patch
git apply searah-username-update.patch
```

Jika pemeriksaan pertama gagal, jangan paksa menimpa file. Kode di komputermu mungkin sudah berubah; cocokkan perubahan yang disebut Git terlebih dahulu. Jangan jalankan patch yang sama dua kali.

3. Coba secara lokal:

```sh
npm run dev
```

Perintah ini otomatis menerapkan `0002_username_optional_email.sql` ke D1 lokal, lalu menjalankan website. Coba daftar akun tanpa email, tambah email di profil, kosongkan lagi, dan coba login menggunakan username. Hentikan dengan Ctrl+C setelah selesai.

4. Sebelum migrasi produksi, kamu bisa menyimpan backup database di luar folder repository:

```sh
npx wrangler d1 export DB --remote --output=../searah-before-username.sql
```

File backup berisi data akun. Simpan secara pribadi dan jangan commit ke GitHub.

5. Terapkan migrasi baru ke D1 produksi **sebelum push/deploy kode baru**:

```sh
npm run db:migrate:remote
```

Gunakan `wrangler.jsonc` yang sudah berisi database ID milikmu. Jangan mengganti `AUTH_SECRET` yang sudah dipakai. Wrangler mencatat migrasi yang sudah diterapkan; jalankan lewat perintah migrasi, bukan mengeksekusi file SQL yang sama berulang kali secara manual.

6. Commit file pembaruan dan push:

```sh
git add src migrations scripts tests README.md VALIDATION.md UPDATE_USERNAME.md
git commit -m "Use usernames and optional profile email"
git push
```

File `.patch` sengaja tidak dimasukkan dalam daftar `git add` di atas. Tunggu deployment Pages selesai, lalu reload website. Tidak perlu membuat D1 atau secret baru.

## Menggunakan akun yang sudah ada

1. Login menggunakan **email dan password lama** pada kolom Username.
2. Buka **Profil saya**, atau klik pengingat **Atur username**.
3. Pilih username yang belum dipakai. Contoh: `agung`, `agung_gowes`, atau `teman-gowes`.
4. Email lama tetap ada di profil. Kamu boleh mempertahankan, mengganti, atau mengosongkannya.
5. Simpan profil. Mulai login berikutnya, gunakan **username + password**.

Pemilihan username tidak mengubah password. Akun yang masih login tetap memiliki sesi yang sama. Kamu tidak perlu mendaftar ulang atau menghapus database.

Username bisa diubah lagi melalui profil. Email opsional berfungsi sebagai kontak saja; penambahan email tidak mengaktifkan verifikasi atau reset password otomatis. Akun baru selalu login dengan username.

## Migrasi dan data lama

Migrasi pertama `0001_initial.sql` tidak diubah. Migrasi kedua menambahkan username dan email nullable sambil mempertahankan tabel `users` dan seluruh ID-nya. Kolom email lama yang memiliki constraint NOT NULL diubah menjadi `account_key` internal berisi ID akun, lalu email lama dipindahkan ke kolom email opsional. Tidak ada alamat email palsu yang dibuat untuk akun baru.

Tabel akun tidak di-drop atau dibuat ulang, sehingga tidak memicu penghapusan berantai pada jadwal, peserta, checklist, pesan, atau sesi. Pengujian integrasi memakai data sebelum migrasi dan memeriksa bahwa seluruh relasinya bertahan.

Pembaruan diuji secara lokal pada Worker hasil build dan D1 sementara. Deployment ke akun Cloudflare kamu tetap dilakukan melalui push GitHub di atas.
