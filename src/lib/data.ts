import manifest from '../generated/manifest.json';

export interface Photo { name: string; caption: string; w: number; h: number; thumb: string; large: string; orig: string }
export interface Gallery { slug: string; dir: string; title: string; description: string; bodyHtml: string; photos: Photo[] }
export interface Post { slug: string; dir: string; title: string; date: string; html: string }

export const site = manifest.site as {
  title: string; siteUrl?: string; language?: string; contactBackground?: string;
  downloadOriginal?: boolean; social?: Record<string, string>;
};
export const home = manifest.home as { slides: { src: string; w: number; h: number }[]; intro: { title: string; html: string } };
export const galleries = manifest.galleries as Gallery[];
export const posts = manifest.posts as Post[];

// ---- 路径辅助：兼容部署在子目录 ----
const rawBase = import.meta.env.BASE_URL || '/';
export const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
/** 站内链接/资源地址，例如 url('gallery/') → '/gallery/' */
export const url = (p = '') => base + p.replace(/^\//, '');
/** 把 Blog 正文里的占位符换成真实 base */
export const fixHtml = (html: string) => html.split('@@BASE@@').join(base);

export function neighbours<T extends { slug: string }>(list: T[], slug: string) {
  const i = list.findIndex((x) => x.slug === slug);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}
export const fullUrl = (p: string) => (site.siteUrl ? site.siteUrl.replace(/\/$/, '') : '') + url(p);
