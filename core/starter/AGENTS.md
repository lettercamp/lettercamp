# Lettercamp publication

This folder contains a Lettercamp publication. Keep custom components and their
supporting files inside the publication.

## Custom component dependencies

- For Lettercamp-hosted publications, custom components can import `react`, `react-dom`, `lettercamp/components`, and
  local components, JavaScript or TypeScript helpers, and CSS or Sass files.
- Other npm packages are not supported in hosted custom components, including
  icon libraries and framework-specific components. Use inline SVG elements or local icon components and
  standard HTML elements for links and images.
- Installing a package locally or adding it to `package.json` does not make it
  available when publishing to Lettercamp. Do not rely on dependencies installed
  in a parent project or on packages used internally by Lettercamp.
- Import local files with relative paths and exact filename casing. Do not use
  package.json `#` aliases, tsconfig aliases such as `@/`, or absolute file paths.
- Use CSS or Sass, including component-specific `.module.css` or `.module.scss` files.
  The CLI includes the Sass compiler. Less and Stylus are not supported.
- Keep imported source files inside `pages/`, `components/`, `lib/`, `styles/`, or
  `assets/`. Layout overrides need a default export.
- After changing components, styles, or MDX, run `npx lettercamp check --json`.
  Fix the reported problems and rerun until `ok` is true and `build` is `passed`.
  Do not treat `--no-build` as a complete check. Do not fix Cloud import errors
  by installing packages or adding bundler externals.
- A successful local preview or standalone build does not guarantee hosted
  compatibility. Use `npx lettercamp dev` to inspect layout and interactions in
  addition to the Cloud check. The check does not deploy or upload anything.
- Self-hosted builds can use dependencies installed in their own build environment.

## Custom layouts

- Optional `Header`, `Footer`, `PostList`, `PostCard`, and `PostLayout` files in
  `components/layouts/` replace their defaults independently. Nested paths take
  precedence over legacy flat `components/` paths. Ordinary reusable components
  can live in `components/elements/`; they are not automatically rendered. Use one `.jsx` or `.tsx` file per name.
- `PostList` receives posts, categories, pagination, site settings, and a resolved
  `PostCard` component. `PostCard` also applies to default related-post cards.
- `PostLayout` receives post metadata, headings, related posts, site settings,
  the resolved `PostCard`, and `children`. Render `children` once: Lettercamp
  supplies the article body with all built-in rich blocks and their styles.
- Keep content in `pages/*.md` or `pages/*.mdx`. Do not move article text into
  templates or parse Markdown yourself. This preserves online rich editing.
- Templates own their markup and SCSS Modules. Use the supplied `site` settings
  where online design controls should apply. URLs in `post.href`, `post.image`,
  author images, categories, and pagination are already resolved.
- Cloud previews use components from the last successful build and live draft
  content/settings. Publish code changes to update that bundle. Arbitrary MDX
  imports still appear as placeholders in the online editor and draft preview.
- See [Custom layouts](https://www.lettercamp.com/docs/custom-layout) for props,
  examples, styling hooks, and preview behavior.

## Upload images and fonts

- When building or editing this publication, use `npx lettercamp upload` to upload
  images and fonts needed for the requested changes. Use the saved CLI login;
  the user does not need to upload each file manually. Check the session with
  `npx lettercamp whoami --json`. If sign-in is required, have the user complete
  `npx lettercamp login` once.
- Use the publication's connected site, or pass its known slug explicitly:
  `npx lettercamp upload cover.png portrait.jpg --site my-blog --json`.
  Uploads require an existing accessible Cloud site. Do not guess the destination
  when the publication is not connected and multiple sites are available.
- Read the returned URLs and write them into the relevant source or settings.
  Reuse existing hosted URLs for unchanged assets. Uploading does not edit source
  or publish the site. For batches, retain successful URLs and retry only failures.
- Image uploads trigger background optimization through the same flow as the web
  editor. The original URL is usable immediately; keep it in source instead of
  constructing variant URLs. GIFs, animated images, and AVIF uploads keep their
  originals. Fonts do not run image optimization.
- Use `upload` when a hosted URL is needed now. Files in `public/` and supported
  referenced local images can also be uploaded automatically during `deploy`.
  Run `npx lettercamp check --json` after updating references; `check` never uploads.
- See [CLI uploads](https://www.lettercamp.com/docs/cli/upload) for supported formats,
  output fields, limits, and optimization behavior.

## Deploy this folder

- The first `npx lettercamp deploy` creates a new site. Later deploys update that
  folder's saved deployment destination; there is no option to select and replace
  an unrelated existing site. Initial setup needs an interactive terminal.
- Interactive deploys show the verified account before proceeding. Automated
  redeploys can reuse a valid login and established destination without prompts.
- Use `npx lettercamp deploy --new` only when the requested outcome is a separate
  new site. It changes this folder's future deployment destination and leaves the
  previous site unchanged. Do not use it as an automatic retry for a failed deploy.
- Resume an interrupted deployment or site creation with `npx lettercamp deploy`.
  If remote source changed, review it in Cloud instead of overwriting it.
- `upload --site` remembers an asset-upload destination separately; it never
  changes this folder's deployment destination.

## Resources

- [Lettercamp](https://www.lettercamp.com)
- [Lettercamp documentation](https://www.lettercamp.com/docs)

## Reusable UI

- Import optional UI from `lettercamp/components`: `PostByline`, `SearchButton`,
  `ShareButton`, `TableOfContents`, `Pagination`, `CategoryNavigation`, `RelatedPosts`,
  `PostHeader`, `Header`, `Footer`, and `PostCard`. Public Header/Footer/PostCard
  always render defaults, so they can safely be wrapped by an override.
  These include default styling and behavior; no extra package installation is needed.
- Copy the default-looking `examples/layouts/` files into `components/layouts/`
  as a starting point. Layouts arrange elements; imported elements own their
  default appearance and behavior. Components are
  only shown where you render them; Lettercamp does not insert missing navigation.
- Pass live `site` settings to `PostByline`, `TableOfContents`, and `RelatedPosts`.
  Pass normalized `post`, `headings`, `categories`, and `pagination` from the layout.
  `<Pagination {...pagination} />` includes the listing base URL.
- All helpers accept `className` and `style`. Use documented global part classes
  for dialogs; they render outside the custom layout. See the UI components guide.
- `ShareButton` shares the current page, not a card's destination. Search uses the
  last built search index, including in the online preview.
- Keep the managed article `children` intact. These helpers do not replace tables,
  images, or other editor content blocks.
