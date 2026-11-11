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
  <code>npm create lettercamp</code>
</p>

<p align="center">
  <a href="https://www.lettercamp.com/docs">Documentation</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="https://www.lettercamp.com/docs/cli">CLI reference</a> ·
  <a href="https://www.lettercamp.com">Lettercamp Cloud</a>
</p>

<br>

## What is Lettercamp?

Lettercamp is an open-source platform that makes it easy to create and manage a modern content publication site. It's basically a blog in a box. The framework ships with all the features you expect from a modern content site, including markdown and MDX support, search, table of contents, related articles, author profiles, and much more.

![Lettercamp publication](https://static.lettercamp.com/assets/lettercamp/static/dBD-_GPKP_Rd-lettercamp-site.webp)

- **Write in Markdown and MDX** Keep your content in files and make it easier for your agent to draft and edit content without relying on a database.
- **Spin up a modern content site quickly** Lettercamp ships everything you need to publish and more, so you can focus on creating and publishing the best content possible.
- **Customize to your brand** Easily replace brand logos, fonts, and colors so that your publication reflects your brand.
- **Free and open-source** The core Lettercamp framework is [MIT-licensed](LICENSE), giving you complete control over your content, publication, and deploys. Our company operates [Lettercamp Cloud](https://www.lettercamp.com), which offers an hosted version.

![Lettercamp Post](https://static.lettercamp.com/assets/lettercamp/static/W0DwSaJZH6Xe-post-screenshot.webp)

Lettercamp ships with several built-in features that help you more easily ship content articles:

- **Full rich content support** Add quotes, codeblocks, tables, images, and more directly in markdown and have these reflected on your post content.
- **Built-in pagination and search** Your blog automatically scales to any number of posts while staying optimized for search engines and AI agents.
- **SEO optimized** Blog posts support authors, metadata, table of contents, and other SEO-friendly features to help your content rank better.
- **Performant (100 across Lighthouse scores)** Optimized for speed out of the box so you can focus on writing instead of tweaking loading times.

![Lettercamp Lighthouse Scores](https://static.lettercamp.com/assets/lettercamp/static/yNsrOBzh8ZjB-lettercamp-lighthouse-perf.avif)

## Why Lettercamp?

If you want to start publishing content on your domain, you'll have to build a content site that supports rendering articles, post pages, pagination, authors, SEO features, and much more. Lettercamp provides all of these features (and more) out of the box, letting you focus on building your own product instead of building a content site.

Existing solutions require building your entire website on a third party provider, or managing a headless CMS which contains your content in a third party database. Lettercamp solves these issues by providing an entire site as a static site, which means published content pages are fast, performant, and easier to manage. Lettercamp is built on top of the popular open-source [Astro framework](https://github.com/withastro/astro).

Finally, Lettercamp is designed to make it easy to connect your content to an AI agent. Instead of drafting articles and then copying and pasting them into a third party site, with Lettercamp your agent can directly iterate on the code to draft articles and create interactive content experiences. Since the markdown lives directly in your codebase, there's no complicated MCP setup or signups required. Just iterate directly with your agent on your content as you would with any other local files.

![Lettercamp MDX example](https://static.lettercamp.com/assets/lettercamp/static/AthIMhCtM49K-lettercamp-markdown.avif)

## Quick start

Create your first publication:

```bash
npm create lettercamp@latest my-lettercamp-site
cd my-lettercamp-site
npm run dev
```

Want to see a live example of Lettercamp? You can check out the [Lettercamp starter site](https://starter.lettercamp.site).

Setup includes local images and fonts by default. To optionally start with
already-hosted assets, use `npm create lettercamp@latest my-lettercamp-site -- --remote-assets`.
See [creation options](https://www.lettercamp.com/docs/cli/new) for details.

See the [documentation](https://www.lettercamp.com/docs) for customization and
[publishing with the CLI](https://www.lettercamp.com/docs/cli), or use
[Lettercamp Cloud](https://www.lettercamp.com) for a web editor and managed hosting.

## Installation with agents

Just ask your favorite agent to create a new Lettercamp site for you. You can also point it to this repository, or our [official documentation](https://www.lettercamp.com/docs) for guidance.

## Customization

![Lettercamp Presets](https://static.lettercamp.com/assets/lettercamp/static/3gY1yJWkx40J-lettercamp-presets.webp)

Lettercamp ships with a few default presets, but makes it easy to customize your publication site with your own branding, font, and colors.

If the native options aren't enough, you can extend Lettercamp with custom implementations for components, headers, footers, and more.

## Roadmap

Our team plans to continue improving Lettercamp based on feedback from the community. There are several areas on the immediate roadmap:

- **Translation and i18n** Native support for multiple languages and localization to improve global content reach.
- **Integrated AI Agent** Readers can interact or chat with the content directly using an AI agent
- **Expanded integrations** Lettercamp posts should natively support popular third-party services and tools and embed content seamlessly.
- **Additional UI enhancements** Continuous improvements to the user interface for a better reading experience. Posts can include more rich elements, such as dark mode, reading progress, bookmarking, saved selections, and more.

If you have suggestions or ideas for the roadmap, please [open an issue](https://github.com/lettercamp/lettercamp/issues) to share your thoughts with the community.

## Lettercamp Cloud

[Lettercamp Cloud](https://www.lettercamp.com) is the hosted platform for deploying and managing Lettercamp sites. In addition to providing hosting for the built sites, Lettercamp Cloud also offers a web-based editor and dashboard, which allows your content team to edit and manage content without needing to commit code. This product also includes several enterprise ready features, including access control, user management, payments, and more. However, the core publication site remains the same as the open-source offering.

![Lettercamp Cloud](https://static.lettercamp.com/assets/lettercamp/static/7CxWPr7PK4n2-lettercamp-cloud.avif)

## Contributing

Bug reports, fixes, documentation improvements, and feature ideas are welcome.
[Open an issue](https://github.com/lettercamp/lettercamp/issues) to report a problem
or discuss a larger change before starting work.

For local development, use the Node.js version in [`.nvmrc`](.nvmrc), then run
`npm ci` and `npm run dev`. Before opening a pull request, run `npm run check` and
`npm run build`, and describe how you verified your changes.

## License and assets

Code is licensed under the [MIT license](LICENSE).

<br>

![Lettercamp Landscape](https://static.lettercamp.com/assets/lettercamp/static/Ur8IRfI8TPtx-lettercamp-footer.webp)
