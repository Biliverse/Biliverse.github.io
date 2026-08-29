import fs from 'node:fs';
import path from 'node:path';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rspress/core';
import remarkGithub from 'remark-github';
import { pluginChangelog } from 'rspress-plugin-changelog';
import type { ChangelogPluginOptions } from 'rspress-plugin-changelog';
import pluginSitemap from 'rspress-plugin-sitemap';

const generateChangelogParams = (items: Omit<ChangelogPluginOptions['items'][number], 'type'>[]) =>
  items.map<ChangelogPluginOptions['items'][number]>((item) => ({
    type: 'github-releases',
    templatePath: './changelog.handlebars',
    ...item,
  }));

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'Biliverse',
  description: '哔哩哔哩功能优化及增强解决方案',
  icon: 'https://avatars.githubusercontent.com/u/129515498?s=200&v=4',
  logo: 'https://avatars.githubusercontent.com/u/129515498?s=80&v=4',
  logoText: 'Biliverse',
  // logo: {
  //   light: '/rspress-light-logo.png',
  //   dark: '/rspress-dark-logo.png',
  // },
  head: [
    ['link', { ref: 'preconnect', href: '//ipolyfill.edge-byted.com' }],
    ['link', { ref: 'dns-prefetch', href: '//ipolyfill.edge-byted.com' }],
    ['script', { src: '//ipolyfill.edge-byted.com/0.0.25/polyfill.min.js', crossorigin: '' }],
  ],
  themeConfig: {
    lastUpdated: true,
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/Biliverse' },
      {
        icon: {
          svg: fs.readFileSync(path.join(__dirname, 'docs', 'public', 'telegram.svg'), 'utf-8'),
        },
        mode: 'link',
        content: 'https://t.me/GetSomeFries',
      },
    ],
  },
  builderConfig: {
    plugins: [pluginSass()],
    resolve: {
      alias: {
        'rspress/theme': '@rspress/core/theme',
      },
    },
  },
  markdown: {
    remarkPlugins: [[remarkGithub]],
  },
  plugins: [
    pluginSitemap({
      domain: 'https://biliverse.github.io',
    }),
    pluginChangelog({
      addSidebar: false,
      fetchOnDev: false,
      items: generateChangelogParams([
        {
          title: '⚙ Enhanced',
          routePath: 'enhanced',
          repo: 'Biliverse/Enhanced',
        },
        {
          title: '🌐 Global',
          routePath: 'global',
          repo: 'Biliverse/Global',
        },
        {
          title: '🔀 Redirect',
          routePath: 'redirect',
          repo: 'Biliverse/Redirect',
        },
        {
          title: '🛡️ ADBlock',
          routePath: 'ad-block',
          repo: 'Biliverse/ADBlock',
        },
        {
          title: '✈ Roaming',
          routePath: 'roaming',
          repo: 'Biliverse/Roaming',
        },
      ]),
    }),
  ],
});
