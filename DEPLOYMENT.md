# Hướng dẫn Deploy "The Smurf" lên GitHub

## 🚀 Quick Start - Deploy trong 5 phút

### Bước 1: Chuẩn bị

```bash
# Clone hoặc copy project vào máy của bạn
cd the-smurf

# Cài dependencies
npm install

# Test local
npm run dev
```

Mở http://localhost:3000 để kiểm tra app chạy OK.

### Bước 2: Build Production

```bash
npm run build
```

Folder `dist` sẽ được tạo với production build.

### Bước 3: Deploy lên GitHub Pages

#### 3.1. Tạo GitHub Repository

1. Tạo repo mới trên GitHub: https://github.com/new
2. Tên repo: `the-smurf` (hoặc tên khác)
3. Public repository
4. **Không** chọn "Initialize with README"

#### 3.2. Push code lên GitHub

```bash
# Khởi tạo git (nếu chưa có)
git init

# Add tất cả files
git add .

# Commit
git commit -m "Initial commit - The Smurf Movie Website"

# Link với remote repository
git remote add origin https://github.com/YOUR-USERNAME/the-smurf.git

# Push code
git push -u origin main
```

#### 3.3. Cấu hình cho GitHub Pages

**Option A: Deploy với Vercel (Khuyến nghị - Dễ nhất)**

1. Vào https://vercel.com/
2. Sign in bằng GitHub
3. Click "New Project"
4. Chọn repository `the-smurf`
5. Click "Deploy"
6. Đợi 1-2 phút → DONE! 🎉

Vercel sẽ auto-detect Vite và deploy. Link sẽ như: `https://the-smurf.vercel.app`

**Option B: Deploy với GitHub Pages**

```bash
# 1. Install gh-pages
npm install --save-dev gh-pages

# 2. Update vite.config.js
# Thay base: '/' thành:
# base: '/the-smurf/',  // Tên repo của bạn

# 3. Add scripts vào package.json
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}

# 4. Deploy
npm run deploy
```

5. Vào repo Settings > Pages
6. Source: chọn branch `gh-pages`
7. Save

Website sẽ available tại: `https://YOUR-USERNAME.github.io/the-smurf/`

### Bước 4: Setup Firebase (Optional - Cho Watch Party)

Nếu bạn muốn tính năng Watch Party (xem phim cùng bạn bè):

1. Tạo project tại https://console.firebase.google.com/
2. Chọn "Realtime Database"
3. Copy config từ Project Settings
4. Tạo file `.env` trong project:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

5. Security Rules cho Database:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

6. Rebuild và deploy lại:

```bash
npm run build
npm run deploy  # hoặc push lên Vercel
```

## 📋 Checklist trước khi deploy

- [ ] `npm run build` chạy thành công
- [ ] Không có error trong console
- [ ] Test local với `npm run dev`
- [ ] API ophim1.com hoạt động (tự động, không cần config)
- [ ] Tất cả pages load được (Home, Search, Browse, MovieDetail, Watch, Profile)
- [ ] README.md đã update với link demo

## 🔧 Troubleshooting

### Lỗi: "Failed to fetch"
→ Kiểm tra API ophim1.com có hoạt động không

### Lỗi: "404 Not Found" trên GitHub Pages
→ Kiểm tra `base` trong `vite.config.js` đã đúng tên repo chưa

### Lỗi: Video không play
→ Đây là do nguồn video từ ophim1.com, một số phim có thể không có link

### Firebase không hoạt động
→ Kiểm tra .env có đúng config không
→ Kiểm tra Security Rules đã setup chưa

## 🎉 Done!

Website của bạn đã live! Share link với bạn bè:
- Vercel: `https://the-smurf.vercel.app`
- GitHub Pages: `https://YOUR-USERNAME.github.io/the-smurf/`

## 📝 Next Steps (Optional)

1. **Custom Domain**: Mua domain và point đến Vercel/GitHub Pages
2. **Analytics**: Thêm Google Analytics
3. **SEO**: Optimize meta tags, sitemap
4. **PWA**: Biến thành Progressive Web App
5. **More Features**: Watch Party, Comments, Ratings

---

Made with ❤️ using React + Vite + ophim1.com API
