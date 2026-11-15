// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://resolvd.dev',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    sitemap({
      // /docs/ is a redirect to the latest version; llms.txt isn't a page.
      filter: (page) => !/\/docs\/$/.test(page) && !page.endsWith('/llms.txt'),
    }),
  ]
});