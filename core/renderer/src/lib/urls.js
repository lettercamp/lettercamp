import { publicationPath } from './publication-url.js';
export const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
export const sitePath = path => publicationPath(path, basePath);
