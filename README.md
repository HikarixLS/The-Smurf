# The Smurf - Push và Deploy theo 3 mục

Repository này được chia theo 3 mục chính để push và deploy trên GitHub:

1. File Website
2. File Android
3. File iOS

## 1) File Website

Các file chính:

- `src/`
- `public/`
- `index.html`
- `vite.config.js`

Lệnh local:

```bash
npm install
npm run build
```

Deploy website lên GitHub Pages:

```bash
npm run deploy
```

GitHub Action tương ứng:

- `.github/workflows/website-deploy.yml`

## 2) File Android

Các file chính:

- `android/`
- `capacitor.config.json`
- `src/` và `public/` (web assets dùng chung)

Lệnh local:

```bash
npm run android:sync
npm run android:debug
```

APK output:

- `android/app/build/outputs/apk/debug/app-debug.apk`

GitHub Action tương ứng:

- `.github/workflows/android-build.yml`

## 3) File iOS

Các file chính:

- `ios/`
- `capacitor.config.json`
- `src/` và `public/` (web assets dùng chung)

Lệnh local:

```bash
npm run ios:add
npm run ios:sync
npm run ios:open
```

GitHub Action tương ứng:

- `.github/workflows/ios-build.yml`

Lưu ý: iOS simulator chỉ chạy trên macOS (Xcode). Trên Windows, bạn vẫn có thể tạo/sync iOS project nhưng không chạy simulator native.

## Push code lên GitHub

Sau khi chỉnh sửa bất kỳ mục nào:

```bash
git add .
git commit -m "update website/android/ios"
git push origin main
```

Khi push lên `main`, workflow tương ứng sẽ tự chạy theo file thay đổi.
