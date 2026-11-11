# Lettercamp publication

This folder contains a Lettercamp publication. Keep custom components and their
supporting files inside the publication.

## Custom component dependencies

- For Lettercamp-hosted publications, custom components can import `react`, `react-dom`, and
  local components, JavaScript or TypeScript helpers, and CSS files.
- Other npm packages are not supported in hosted custom components, including
  icon libraries and framework-specific components. Use inline SVG elements or local icon components and
  standard HTML elements for links and images.
- Installing a package locally or adding it to `package.json` does not make it
  available when publishing to Lettercamp. Do not rely on dependencies installed
  in a parent project or on packages used internally by Lettercamp.
- Import local files with relative paths and exact filename casing. Do not use
  package.json `#` aliases, tsconfig aliases such as `@/`, or absolute file paths.
- Use plain CSS or CSS Modules (`.module.css`), not Sass, Less, or Stylus.
  Convert preprocessor syntax; renaming `.scss` to `.css` alone is not enough.
- Keep imported source files inside `pages/`, `components/`, `lib/`, `styles/`, or
  `assets/`. Header and footer overrides need a default export.
- After changing components, styles, or MDX, run `npx lettercamp check --json`.
  Fix the reported problems and rerun until `ok` is true and `build` is `passed`.
  Do not treat `--no-build` as a complete check. Do not fix Cloud import errors
  by installing packages or adding bundler externals.
- A successful local preview or standalone build does not guarantee hosted
  compatibility. Use `npx lettercamp dev` to inspect layout and interactions in
  addition to the Cloud check. The check does not deploy or upload anything.
- Self-hosted builds can use dependencies installed in their own build environment.

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

## Resources

- [Lettercamp](https://www.lettercamp.com)
- [Lettercamp documentation](https://www.lettercamp.com/docs)
