import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>The Smurf</h3>
          <p>Xem phim online chất lượng cao, phim mới nhất, phim hay nhất.</p>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Danh mục</h3>
          <ul className={styles.footerLinks}>
            <li><a href="/" className={styles.footerLink}>Trang chủ</a></li>
            <li><a href="/browse?type=single" className={styles.footerLink}>Phim lẻ</a></li>
            <li><a href="/browse?type=series" className={styles.footerLink}>Phim bộ</a></li>
            <li><a href="/browse" className={styles.footerLink}>Thể loại</a></li>
          </ul>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Hỗ trợ</h3>
          <ul className={styles.footerLinks}>
            <li><span className={styles.footerLink}>Liên hệ</span></li>
            <li><span className={styles.footerLink}>Điều khoản</span></li>
            <li><span className={styles.footerLink}>Chính sách</span></li>
          </ul>
        </div>
      </div>

      <div className={styles.copyright}>
        © 2025 The Smurf. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
