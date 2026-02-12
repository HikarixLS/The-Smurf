import styles from './Loader.module.css';

const Loader = ({ size = 'medium', text = '' }) => {
  return (
    <div className={styles.loaderContainer}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.bounce1}></div>
        <div className={styles.bounce2}></div>
        <div className={styles.bounce3}></div>
      </div>
      {text && <p className={styles.loadingText}>{text}</p>}
    </div>
  );
};

export default Loader;
