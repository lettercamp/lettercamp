import type { ComponentPropsWithoutRef, ComponentType, CSSProperties, ReactElement, ReactNode } from 'react';

export interface ComponentStyle extends CSSProperties {
  [property: `--${string}`]: string | number | undefined;
}

interface AppearanceProps {
  className?: string;
  style?: ComponentStyle;
}

interface SiteLink {
  label: string;
  href: string;
}

interface SiteFont {
  google?: string;
  url?: string;
  weight?: string;
}

export interface SiteSettings {
  name: string;
  logo: string;
  favicon: string;
  description?: string;
  language?: string;
  timeZone?: string;
  home: {
    title: string;
    feedLayout?: 'grid' | 'rows' | 'column';
    contentWidthPx?: number;
    postOrder?: string[];
  };
  post?: {
    heroLayout?: 'stacked' | 'split';
    contentWidthEm?: number;
    showCover?: boolean;
    showTableOfContents?: boolean;
    showReadingTime?: boolean;
    showRelatedPosts?: boolean;
  };
  postFields?: string[];
  design?: {
    backgroundColor?: string;
    accentColor?: string;
    imageRadiusPercent?: number;
    typography?: {
      localFonts?: boolean;
      headingFont?: SiteFont;
      bodyFont?: SiteFont;
      headingColor?: string;
      bodyColor?: string;
      headingBaseSizePx?: number;
      bodyBaseSizePx?: number;
      bodyLineHeight?: number;
    };
  };
  header?: { position?: 'fixed' | 'scroll'; links?: SiteLink[]; button?: (SiteLink & { color?: string }) | null };
  footer?: { columns?: { header: string; items: SiteLink[] }[]; socials?: { platform: string; href: string }[] };
  seo?: { ogImage?: string; ogImageAlt?: string; metaTitle?: string; ogTitle?: string; ogDescription?: string; keywords?: string[] };
  analytics?: { googleAnalyticsId?: string };
  [setting: string]: unknown;
}

export interface PostDate {
  iso: string;
  label: string;
  timestamp: number;
}

export interface Author {
  name: string;
  image?: string;
  /** Plain-text bio saved with the post. */
  bio?: string;
}

export interface Post {
  title: string;
  /** Resolved URL path, including the publication's base path. */
  href: string;
  description?: string;
  category: string;
  categoryHref?: string;
  /** Resolved cover URL, when the post has a cover. */
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  ogImage?: string;
  showCover?: boolean;
  coverWidthMode?: 'regular' | 'wide' | 'full';
  coverWidth?: string | number;
  authors: Author[];
  date: PostDate;
  readingMinutes?: number;
  /** Optional author-defined metadata from the post's customFields frontmatter. */
  customFields?: Record<string, string | string[]>;
  [frontmatter: string]: unknown;
}

export interface Category {
  name: string;
  href: string;
  tag?: string;
}

export interface Heading {
  depth: 2 | 3;
  slug: string;
  text: string;
}

export interface PostPagination {
  current: number;
  total: number;
  count: number;
  base: string;
  previous: string | null;
  next: string | null;
}

export interface LayoutProps {
  site: SiteSettings;
  pathname: string;
  /** The publication subfolder, e.g. `/blog`, or an empty string. */
  basePath: string;
}

export type HeaderLayoutProps = LayoutProps;
export type FooterLayoutProps = LayoutProps;

export interface PostCardLayoutProps extends LayoutProps {
  post: Post;
  priority: boolean;
}

type LayoutPostCard = ComponentType<{ post: Post; priority?: boolean }>;

export interface PostListProps extends LayoutProps {
  posts: Post[];
  categories: Category[];
  category: string;
  pagination: PostPagination;
  PostCard: LayoutPostCard;
  current: number;
  total: number;
  count: number;
  base: string;
}

export interface PostLayoutProps extends LayoutProps {
  post: Post;
  headings: Heading[];
  relatedPosts: Post[];
  PostCard: LayoutPostCard;
  /** The managed article body. Render it once inside the layout. */
  children: ReactNode;
}

interface SiteElementProps extends AppearanceProps {
  site?: SiteSettings;
}

interface NavigationProps extends SiteElementProps {
  pathname?: string;
}

export function Header(props: NavigationProps): ReactElement;
export function Footer(props: NavigationProps): ReactElement;

export function PostCard(props: SiteElementProps & {
  post: Post;
  priority?: boolean;
}): ReactElement;

export function PostHeader(props: SiteElementProps & {
  post: Post;
  layout?: 'stacked' | 'split';
  showCover?: boolean;
  showShare?: boolean;
}): ReactElement;

export function PostByline(props: SiteElementProps & {
  post: Partial<Pick<Post, 'authors' | 'date' | 'readingMinutes'>>;
  variant?: 'article' | 'listing';
  date?: PostDate | null;
  showAuthors?: boolean;
  showAvatars?: boolean;
  showDate?: boolean;
  showReadingTime?: boolean;
}): ReactNode;

type ButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'style' | 'type'> & AppearanceProps;

export function SearchButton(props: ButtonProps): ReactElement;
export function ShareButton(props: ButtonProps): ReactElement;

export function TableOfContents(props: SiteElementProps & {
  headings?: Heading[];
  title?: string;
  variant?: 'sidebar' | 'floating';
  show?: boolean;
}): ReactElement | null;

export function Pagination(props: AppearanceProps & Pick<PostPagination, 'current' | 'total' | 'base'>): ReactElement | null;

export function CategoryNavigation(props: AppearanceProps & {
  categories?: Category[];
  category?: string;
  allLabel?: string;
}): ReactElement;

export function RelatedPosts(props: SiteElementProps & {
  posts?: Post[];
  title?: string;
  pathname?: string;
  hidden?: boolean;
  show?: boolean;
}): ReactElement | null;

export function Subscribe(props: SiteElementProps & {
  title?: string;
  description?: string;
  buttonLabel?: string;
}): ReactElement;

export interface SubscriptionResult {
  preview: boolean;
  message: string;
}

export function subscribeEmail(email: string, website?: string): Promise<SubscriptionResult>;

export function useSubscribe(): {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  subscribe(email: string, website?: string): Promise<SubscriptionResult | undefined>;
};
