
export default function SocialLink({ name, href }) {


const platform = name.trim().toLowerCase();
const names = { x: 'Twitter / X', tiktok: 'TikTok', github: 'GitHub', linkedin: 'LinkedIn', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', website: 'Website', 'hacker-news': 'Hacker News', bluesky: 'Bluesky', discord: 'Discord', slack: 'Slack', medium: 'Medium', telegram: 'Telegram', threads: 'Threads', reddit: 'Reddit', podcast: 'Podcast' };
const label = names[platform] ?? name.replaceAll('-', ' ').replace(/^./, character => character.toUpperCase());
const icons = {
  tiktok: 'M16.6 1c.4 3 2.1 4.8 5.4 5v4a9.5 9.5 0 0 1-5.4-1.7v7.4A7.3 7.3 0 1 1 10.3 8v4.1a3.3 3.3 0 1 0 2.3 3.2V1h4Z',
  x: 'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l8.4-9.6L.8 2h6.5l4.6 7L18.9 2Zm-1.1 18h1.7L6.3 4H4.5l13.3 16Z',
  github: 'M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1 1.83 1.65 3.28.73.1-.73.39-1.23.71-1.51-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.13-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.32c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z',
  linkedin: 'M20.5 2h-17C2.67 2 2 2.67 2 3.5v17c0 .83.67 1.5 1.5 1.5h17c.83 0 1.5-.67 1.5-1.5v-17c0-.83-.67-1.5-1.5-1.5ZM8 19H5V9h3v10ZM6.5 7.7a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM19 19h-3v-5.3c0-1.3-.5-2.1-1.6-2.1-1.2 0-1.9.8-1.9 2.1V19h-3V9h2.9v1.4C13 9.5 14 8.8 15.4 8.8c2.4 0 3.6 1.5 3.6 4.3V19Z',
  youtube: 'M23 7a3 3 0 0 0-2.1-2.1C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7a31 31 0 0 0 0 10 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 17a31 31 0 0 0 0-10ZM9.5 15.5v-7l6 3.5-6 3.5Z',
  facebook: 'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z',
};
const hasIcon = icons[platform] || ['instagram', 'website', 'hacker-news'].includes(platform);
return <><a href={href} aria-label={label} title={label} rel="me noopener noreferrer" target="_blank">
  {hasIcon ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {icons[platform] && <path d={icons[platform]} />}
    {platform === 'instagram' && <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></g>}
    {platform === 'website' && <g fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></g>}
    {platform === 'hacker-news' && <><rect x="2" y="2" width="20" height="20" rx="2" /><path d="m7 6 5 7 5-7m-5 7v5" fill="none" stroke="var(--site-background, #fff)" strokeWidth="1.8" /></>}
  </svg> : <span>{label}</span>}
</a></>;
}
