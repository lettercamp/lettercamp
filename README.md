# Lettercamp

Lettercamp is an [MIT-licensed](LICENSE) blog engine, renderer, and CLI. Write in
Markdown or MDX, preview locally, and build a static publication for your own host.

[Documentation](https://www.lettercamp.com/docs) · [CLI reference](https://www.lettercamp.com/docs/cli) · [Lettercamp Cloud](https://www.lettercamp.com)

## Get started

Use Node.js 22.23.4 or newer:

```bash
npm create lettercamp@latest my-blog
cd my-blog
npm run dev
```

Setup asks for a folder and starter preset, then installs a project-local CLI.
No global installation or Lettercamp account is needed for local development
and static builds.

To choose a preset directly:

```bash
npm create lettercamp@latest my-blog -- --preset dark --yes
```

Available presets are `default`, `dark`, `sand`, `code`, and `minimal`. Use
`--no-install` to install dependencies later. Edit `settings.json` for site
configuration and `pages/` for content. Optional `components/Header.jsx` and
`components/Footer.jsx` files customize the site's header and footer.

## Build and publish

Build a static site for your own host:

```bash
npm run build -- --site https://example.com
```

[Lettercamp Cloud](https://www.lettercamp.com) provides the web editor, hosting,
asset uploads, domains, and deployment. To publish there:

```bash
npm run deploy
npx lettercamp domain example.com/blog
```

Deployment opens browser login and lets you create or connect a Cloud site.
Cloud publishing requires an account. DNS or proxy configuration happens with
your website host; the CLI guides you through the required setup.

For local development and self-hosted builds, put assets in `public/` and use
paths such as `/images/cover.jpg`. Cloud publishing requires hosted asset URLs
and does not upload `public/`; use `lettercamp upload` for supported images and
fonts before deploying. See the [publishing documentation](https://www.lettercamp.com/docs/cli).

Run `npx lettercamp update` from a publication folder to update its CLI. Restart
your preview afterward and review changes to the package and lock files.

## Development

Use the Node.js version in `.nvmrc`, then:

```bash
npm ci
npm run dev
```

The development command previews the bundled starter. CLI commands live in
`core/src/`, the renderer in `core/renderer/`, and starter content and presets in
`core/starter/`. The `wrapper/` and `create/` packages provide the `lettercamp`
and `create-lettercamp` entry points.

Before submitting changes, run `npm run check` and `npm run build`. Include a
brief description of the change and how you verified it. Discuss larger changes
in an issue first, and contribute only code and assets you have permission to
share.

## License and assets

Code is licensed under the [MIT license](LICENSE). Starter images, branding, and
fonts are bundled for local use. Bundled fonts and third-party dependencies
retain their original licenses; keep the font license files when redistributing
them. Contributions use the repository's MIT license. The Lettercamp name and
logo do not grant permission to imply official affiliation.
