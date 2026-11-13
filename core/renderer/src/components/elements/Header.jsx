import { sitePath } from '../../lib/urls.js';
import { buttonColors } from '../../lib/button.js';
import MobileMenuIcons from './MobileMenuIcons.jsx';
import defaultSite from '../../site.js';

export default function Header({ site = defaultSite, pathname = '', className = '', style }) {

const navLinks = site.header?.links ?? [{ label: 'Home', href: '/' }];
const primary = site.header?.button;
const primaryColors = buttonColors(primary?.color, site.design?.accentColor);
const primaryStyle = { '--button-color': primaryColors.background, '--button-text': primaryColors.text };
const logo = sitePath(site.logo);
  return (<header className={`site-header lettercamp-header ${className}`.trim().replace(/\s+/g, ' ')} style={style} data-header-position={site.header?.position === 'fixed' ? 'fixed' : 'scroll'}>
      <div className="site-header-inner">
      <a className="brand" href={sitePath("/")}>
        {logo && <img src={logo} width="30" height="30" alt="" />}
        <span>{site.name}</span>
      </a>
      {(navLinks.length > 0 || primary) && <div className="header-actions">
        {navLinks.length > 0 &&
          <nav className="desktop-navigation" aria-label="Main navigation">
            {navLinks.map((item) =>
              <a key={item.href} href={sitePath(item.href)} aria-current={sitePath(item.href) === pathname ? 'page' : undefined}>{item.label}</a>
            )}
          </nav>}
        {primary && <a className="header-primary" style={primaryStyle} href={sitePath(primary.href)}>{primary.label}</a>}
        {navLinks.length > 0 && <details className="mobile-navigation">
            <summary className="mobile-menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu-panel"><MobileMenuIcons /></summary>
            <nav id="mobile-menu-panel" className="mobile-menu-panel" aria-label="Mobile navigation">
              {navLinks.map((item) =>
                <a key={item.href} href={sitePath(item.href)} aria-current={sitePath(item.href) === pathname ? 'page' : undefined}>{item.label}</a>
              )}
            </nav>
          </details>}
      </div>}
      </div>
    </header>);
}
