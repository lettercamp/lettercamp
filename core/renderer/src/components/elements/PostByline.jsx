import AuthorByline from '../AuthorByline.jsx';
import defaultSite from '../../site.js';

export function PostByline({ post, site = defaultSite, className = '', ...props }) {
  return <AuthorByline {...props} post={post} site={site} className={`lettercamp-post-byline ${className}`.trim().replace(/\s+/g, ' ')} />;
}

// Delegated listeners in the page shell keep buttons working after draft updates
// and allow several buttons to share a single dialog, including across islands.
