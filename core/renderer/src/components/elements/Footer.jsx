import { sitePath } from '../../lib/urls.js';
import SocialLink from './SocialLink.jsx';
import LettercampLogo from './LettercampLogo.jsx';
import defaultSite from '../../site.js';

export default function Footer({ site = defaultSite, pathname = '', className = '', style }) {

const logo = sitePath(site.logo);
const columns = (site.footer?.columns ?? []).slice(0, 4);
const socials = (site.footer?.socials ?? []).filter(({ href }) => {
  try { return typeof href === 'string' && ['https:', 'http:'].includes(new URL(href).protocol); }
  catch { return false; }
});
  return (<footer className={`site-footer lettercamp-footer ${className}`.trim().replace(/\s+/g, ' ')} style={style}>
  <div className={`footer-inner ${columns.length ? 'footer-has-columns' : ''}`.trim().replace(/\s+/g, ' ')} style={{ '--footer-columns': Math.max(columns.length, 1), '--footer-tablet-columns': Math.min(Math.max(columns.length, 1), 3), '--footer-mobile-columns': Math.min(Math.max(columns.length, 1), 2) }}>
  <div className="footer-main">
    <div className="footer-brand">
      <a className="brand" href={sitePath("/")} aria-label={`${site.name} home`}>
        {logo ? <img src={logo} width="24" height="24" alt="" /> : <span>{site.name}</span>}
      </a>
    </div>
    {columns.length > 0 && <div className="footer-columns">
      {columns.map((column, index) => <nav key={index} className="footer-column" aria-label={column.header ?? `Footer links ${index + 1}`}>
        {column.header && <h2>{column.header}</h2>}
        <ul>{(column.items ?? []).map(item => <li key={item.href}><a href={sitePath(item.href)}>{item.label}</a></li>)}</ul>
      </nav>)}
    </div>}
  </div>
  <div className="footer-bottom">
    {socials.length > 0 && <nav className="footer-socials" aria-label="Social links">
      {socials.map(({ platform, href }) => <SocialLink key={href} name={platform} href={href} />)}
    </nav>}
    <a className="footer-credit" href="https://lettercamp.com">Made with <span className="footer-credit-brand"><LettercampLogo />Lettercamp</span></a>
  </div>
  </div>
</footer>);
}
