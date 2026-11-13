import { resolveAuthors } from '../lib/authors.js';
import { postAsset as sitePath } from '../lib/post-data.js';
export default function AuthorByline({ post, site, variant = 'article', date = post.date, showAuthors = true, showAvatars = true, showDate = true, showReadingTime = variant === 'article' && site.post?.showReadingTime !== false, className = '', style }) {
  const authors = (showAuthors ? resolveAuthors(post) : []).filter(author => author.name.trim()).map(author => ({ ...author, image: sitePath(author.image) }));
  const portraits = showAvatars ? authors.filter(author => author.image) : [];
  const readingTime = showReadingTime && typeof post.readingMinutes === 'number';
  const dated = showDate && date?.label;

  return ((authors.length > 0 || readingTime || dated) && <div className={`post-byline ${className}`.trim().replace(/\s+/g, ' ')} style={style}>
    {dated && <time dateTime={date.iso}>{date.label}</time>}
    {authors.length > 0 && <span className="post-authors">
      {portraits.length > 0 && <span className="author-portraits" aria-hidden="true">
        {portraits.map((author, index) => <span key={index} className="author-portrait" title={author.name}>
          <img className="author-avatar" src={author.image} width="24" height="24" alt="" loading="lazy" />
        </span>)}
      </span>}
      <span className="author-names">
        <span className="author-names-desktop">
        {authors.length <= 2 ? authors.map(author => author.name).join(', ') : <>
          {authors.slice(0, 2).map(author => author.name).join(', ')}{' '}
          <button type="button" className="author-more" aria-haspopup="dialog" data-authors={JSON.stringify(authors)}>+ {authors.length - 2} more</button>
          <span className="sr-only">{': ' + authors.slice(2).map(author => author.name).join(', ')}</span>
        </>}
        </span>
        <span className="author-names-mobile">
          <span className="author-name" title={authors[0].name}>{authors[0].name}</span>
          {authors.length > 1 && <button type="button" className="author-more" aria-haspopup="dialog" data-authors={JSON.stringify(authors)}>+ {authors.length - 1} more {authors.length === 2 ? 'author' : 'authors'}</button>}
        </span>
      </span>
    </span>}
    {readingTime && <span className="reading-time">{post.readingMinutes} min read</span>}
  </div>);
}
