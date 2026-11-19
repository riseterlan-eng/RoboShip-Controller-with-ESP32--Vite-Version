# KAPAL KARAM — Project website & web controller

Website pengenalan interaktif untuk proyek robot kapal apung KAPAL KARAM, dengan web controller React/Vite yang dapat dibuka dari halaman pengenalan.

## Jalankan secara lokal

```bash
npm install
npm run dev
```

Vite membuka situs di `http://localhost:3000`. Halaman utama merupakan situs pengenalan; buka `/controller.html` untuk controller. Periksa project dengan `npm run lint` dan buat build produksi dengan `npm run build`.

Web Bluetooth dan Web Serial memerlukan browser yang mendukung API tersebut dan konteks aman HTTPS (atau `localhost`). Safari iOS tidak menyediakan Web Bluetooth bawaan. Pastikan firmware ESP32 menerima protokol perintah yang ditampilkan controller sebelum mengoperasikan perangkat.

## GitHub Pages

Repository ini membangun dan menerbitkan `dist/` secara otomatis ke GitHub Pages setiap ada push ke branch `main`.

1. Pada repository GitHub, buka **Settings → Pages**.
2. Pada **Build and deployment → Source**, pilih **GitHub Actions**.
3. Buka tab **Actions** dan tunggu workflow **Deploy website to GitHub Pages** berhasil.
4. Situs tersedia di `https://riseterlan-eng.github.io/RoboShip-Controller-with-ESP32--Vite-Version/`.

Halaman pengenalan adalah beranda; web controller tersedia melalui tombol **Buka controller** atau langsung di URL `/controller.html`. Workflow memakai base path repository agar aset, controller, dan PWA berjalan pada subfolder GitHub Pages.

## Vercel (opsional)

`vercel.json` tetap tersedia untuk mengimpor repository ini sebagai aplikasi Vite di Vercel. Build default Vite menggunakan root path (`/`); GitHub Pages memakai base path repository melalui workflow.
