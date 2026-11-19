# KAPAL KARAM — Remote Control Robot Kapal Apung ESP32

Aplikasi web progresif (PWA) untuk mengendalikan robot kapal apung berbasis ESP32 melalui Bluetooth. Antarmuka bergaya anjungan maritim menyediakan joystick analog 360°, tuas throttle, D-pad, tombol aksesori, monitor sinyal, serta tampilan protokol dan wiring.

## Fitur

- Pemindai perangkat Bluetooth Low Energy dan Web Serial; daftar hanya menampilkan perangkat yang benar-benar ditemukan.
- Joystick analog 360°, throttle 0–100%, D-pad maju/mundur, dan kontrol aksesori.
- Mode layar penuh, wallpaper pilihan pengguna, serta simpan perangkat favorit.
- PWA yang dapat dipasang di Android dan iOS, dengan dukungan penggunaan offline untuk aset aplikasi.
- Tampilan protokol dan wiring untuk membantu mengintegrasikan controller dengan ESP32.

> Web Bluetooth dan Web Serial memerlukan browser yang mendukung API tersebut dan konteks aman HTTPS (atau `localhost`). Safari iOS tidak menyediakan Web Bluetooth bawaan; gunakan aplikasi/browser yang kompatibel. Koneksi perangkat fisik tidak tersedia di pratinjau tersemat.

## Menjalankan secara lokal

Pastikan Node.js dan npm tersedia, kemudian jalankan:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Periksa tipe dan build produksi dengan:

```bash
npm run lint
npm run build
```

## Deploy ke Vercel

Repository ini sudah menyertakan `vercel.json` dengan perintah build `npm run build`, direktori output `dist`, dan rewrite untuk aplikasi Vite.

1. Push repository ini ke GitHub.
2. Masuk ke [Vercel](https://vercel.com), pilih **Add New → Project**, lalu import repository `riseterlan-eng/RoboShip-Controller-with-ESP32--Vite-Version`.
3. Pertahankan preset **Vite** dan deploy. Vercel akan otomatis membangun ulang setiap ada push ke branch produksi.
4. Buka URL HTTPS yang diberikan Vercel untuk menggunakan fitur Bluetooth dan memasang PWA.

## Lisensi dan perangkat keras

Pastikan firmware ESP32 menerima format perintah yang digunakan aplikasi dan perangkat telah dipasangkan/diizinkan melalui dialog browser. Pengoperasian perangkat fisik bergantung pada dukungan browser, firmware, dan koneksi radio yang digunakan.
