import styles from './Header.module.css';

export default function Header({ site, pathname }) {
  return (
    <header className={styles.header}>
      <a className={styles.name} href="/">{site.name}</a>
      <a href="/" aria-current={pathname === '/' ? 'page' : undefined}>Lorem</a>
    </header>
  );
}
