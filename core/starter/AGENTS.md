# Lettercamp publication

This folder contains a Lettercamp publication. Keep custom components and their
supporting files inside the publication.

## Custom component dependencies

- For Lettercamp-hosted publications, custom components can import `react` and
  local components, JavaScript or TypeScript helpers, and CSS files.
- Other npm packages are not supported in hosted custom components, including
  icon libraries and framework-specific components. Use local SVGs for icons and
  standard HTML elements for links and images.
- Installing a package locally or adding it to `package.json` does not make it
  available when publishing to Lettercamp. Do not rely on dependencies installed
  in a parent project or on packages used internally by Lettercamp.
- A successful local preview or build does not guarantee hosted compatibility.
  Check component imports before declaring a change ready to publish.
- Self-hosted builds can use dependencies installed in their own build environment.

## Resources

- [Lettercamp](https://www.lettercamp.com)
- [Lettercamp documentation](https://www.lettercamp.com/docs)
