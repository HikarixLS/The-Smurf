# The Smurf

The Smurf la ung dung xem phim su dung React + Vite, co web deployment tren GitHub Pages va Android app (Capacitor).

## Tong quan

- Frontend: React 19, Vite 7, React Router 7
- Mobile: Capacitor Android
- Auth: Firebase + Google Sign-In (co fallback phu hop Android TV)
- Streaming: HLS.js
- Deploy website: GitHub Pages

## Cau truc chinh

- src/: UI, pages, services, router, hooks
- public/: static files
- android/: native Android project
- builds/: APK output (local)
- .github/workflows/website-deploy.yml: CI/CD website

## Yeu cau moi truong

- Node.js 20+
- npm 10+
- Java 17 (de build Android)
- Android SDK (de build APK)

## Cai dat

```bash
npm install
```

## Chay local web

```bash
npm run dev
```

## Build web

```bash
npm run build
```

## Deploy website len GitHub Pages

```bash
npm run deploy
```

Luu y:

- Website duoc deploy len nhanh gh-pages.
- Workflow tren GitHub hien tai chi dung cho website deploy.

## Build Android APK

```bash
npm run android:debug
```

APK mac dinh:

- android/app/build/outputs/apk/debug/app-debug.apk

Co the copy ra thu muc builds de de chia se:

```bash
copy android\app\build\outputs\apk\debug\app-debug.apk builds\TheSmurf-google-tv-debug.apk
```

## Android TV / Google TV

Da toi uu cac diem sau:

- Ho tro launch tren giao dien TV (leanback launcher)
- Touchscreen la optional
- Dang nhap Google tren TV co fallback khi thiet bi khong ho tro Credential Service
- Trang login co focus UX tot hon cho remote

## Bien moi truong

Tao file .env.local dua tren .env.example:

- VITE_API_BASE_URL
- VITE_GEMINI_API_KEY
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

## Lint

```bash
npm run lint
```

## Push code len GitHub

```bash
git add .
git commit -m "docs: update README"
git push origin main
```
