<p align="center">
  <a href="https://www.lettercamp.com">
    <img src="https://static.lettercamp.com/assets/lettercamp/static/jE0Iuuw7Fxmx-lettercamp-cover.webp" alt="Lettercamp — modern, open-source publication platform" width="100%">
  </a>
</p>

<h1 align="center">Lettercamp</h1>

<p align="center">
  An open-source framework for beautiful, modern content publications.<br>
  Designed and built for the AI era with full compatibility with agent workflows.<br>
  Write content in Markdown or MDX, preview locally, and publish on your own terms.
</p>

<p align="center">
  <a href="https://www.lettercamp.com/docs">Documentation</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="https://www.lettercamp.com/docs/cli">CLI reference</a> ·
  <a href="https://www.lettercamp.com">Lettercamp Cloud</a>
</p>

## The easiest way to create a beautiful content site

Lettercamp is a free and open-source platform that makes it easy to create and manage a modern content publication. The framework ships with all the features you expect from a modern content site, including markdown and MDX support, search, table of contents, related articles, author profiles, and much more.

![Lettercamp publication](https://static.lettercamp.com/assets/lettercamp/static/6IeBxgBIS5b1-lettercamp-blog-example.webp)

- **Write in Markdown and MDX.** Keep your content in files and make it easier for your agent to draft and edit content without relying on a database.
- **Spin up a modern content site quickly.** Lettercamp ships everything you need to publish and more, so you can focus on creating and publishing the best content possible.
- **Customize to your brand** Easily replace brand logos, fonts, and colors so that your publication reflects your brand.
- **Free and open-source** The core Lettercamp framework is [MIT-licensed](LICENSE), giving you complete control over your content, publication, and deploys. Our company operates [Lettercamp Cloud](https://www.lettercamp.com), which offers an hosted version.

## Why Lettercamp?

If you want to start publishing content on your domain, you'll have to build a content site that supports rendering articles, post pages, pagination, authors, SEO features, and much more. Lettercamp provides all of these features (and more) out of the box, letting you focus on building your own product instead of building a content site.

Existing solutions require building your entire website on a third party provider, or managing a headless CMS which contains your content in a third party database. Lettercamp solves these issues by providing an entire site as a static site, which means published content pages are fast, performant, and easier to manage.

Finally, Lettercamp is designed to be the easiest way to connect your content to an AI agent. Instead of drafting articles and then copying and pasting them into a third party site, with Lettercamp your agent can directly iterate on the code to draft articles and create interactive content experiences.

## MIT license

This Lettercamp repository contains the core framework for building and managing a content publication. It is [MIT-licensed](LICENSE).

## Quick start

Create your first publication:

```bash
npm create lettercamp@latest my-lettercamp-site
cd my-lettercamp-site
npm run dev
```

See the [documentation](https://www.lettercamp.com/docs) for customization and
[publishing with the CLI](https://www.lettercamp.com/docs/cli), or use
[Lettercamp Cloud](https://www.lettercamp.com) for a web editor and managed hosting.

## Lettercamp Cloud

Lettercamp Cloud is the hosted platform for deploying and managing Lettercamp sites. In addition to providing hosting for the built sites, Lettercamp Cloud also offers a web-based editor and dashboard, which allows your content team to edit and manage content without needing to commit code. This product also includes several enterprise ready features, including access control, user management, payments, and more. However, the core publication site remains the same as the open-source offering.

## Contributing

Bug reports, fixes, documentation improvements, and feature ideas are welcome.
[Open an issue](https://github.com/lettercamp/lettercamp/issues) to report a problem
or discuss a larger change before starting work.

For local development, use the Node.js version in [`.nvmrc`](.nvmrc), then run
`npm ci` and `npm run dev`. Before opening a pull request, run `npm run check` and
`npm run build`, and describe how you verified your changes.

## License and assets

Code is licensed under the [MIT license](LICENSE). The Lettercamp name and
logo do not grant permission to imply official affiliation.
