import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.copyright}>
        © 2026 The Smurf. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
