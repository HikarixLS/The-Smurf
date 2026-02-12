import styles from './NotFound.module.css';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className={styles.notFound}>
      <div className="container">
        <h1 className={styles.title}>404</h1>
        <p className={styles.message}>Trang không tồn tại</p>
        <Link to="/" className={styles.homeLink}>
          Quay về trang chủ
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
