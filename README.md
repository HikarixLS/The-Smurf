# The Smurf - Website Only

Repository hiện được cấu hình để chỉ build và deploy Website trên GitHub.

## File website chính

- `src/`
- `public/`
- `index.html`
- `vite.config.js`
- `.github/workflows/website-deploy.yml`

## Build local

```bash
npm install
npm run build
```

## Deploy website lên GitHub Pages

```bash
npm run deploy
```

## Push code

```bash
git add .
git commit -m "update website"
git push origin main
```

Khi push lên `main`, chỉ workflow website chạy để build/deploy.
