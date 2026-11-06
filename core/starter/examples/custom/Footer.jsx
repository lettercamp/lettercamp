import styles from './Footer.module.css';

export default function Footer({ site }) {
  return <footer className={styles.footer}>Lorem ipsum dolor sit amet · {site.name}.</footer>;
}
