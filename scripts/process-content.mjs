// 扫描 content/ 目录，生成缩略图/大图，并输出 src/generated/manifest.json
// 用法：npm run images（npm run build 会自动先执行）
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT_MEDIA = path.join(ROOT, 'public', 'media');
const OUT_MANIFEST = path.join(ROOT, 'src', 'generated', 'manifest.json');

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tif', '.tiff']);
const SIZES = { thumb: 900, large: 2200, hero: 2560, blog: 1600 };
const QUALITY = { thumb: 78, large: 82, hero: 80, blog: 80 };

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const byName = (a, b) => collator.compare(a, b);

const slugify = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'x';

const isImage = (f) => IMG_EXT.has(path.extname(f).toLowerCase());
const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const listDirs = (p) =>
  fs.existsSync(p)
    ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name).sort(byName)
    : [];
const listImages = (p) =>
  fs.existsSync(p) ? fs.readdirSync(p).filter((f) => !f.startsWith('.') && isImage(f)).sort(byName) : [];

/** 文件名 → 默认说明文字：IMG_A_006.jpg → "IMG A 006" */
const captionFromName = (f) => path.basename(f, path.extname(f)).replace(/[_]+/g, ' ').trim();
/** 文件夹名 → 标题：保持原样（"2007 Xuzhou"） */
const titleFromDir = (d) => d.replace(/_/g, ' ').trim();

let stats = { made: 0, cached: 0 };

async function makeVariant(srcFile, outFile, width, quality) {
  if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= fs.statSync(srcFile).mtimeMs) {
    stats.cached++;
    return;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(srcFile, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outFile);
  stats.made++;
}

function copyOriginal(srcFile, outFile) {
  if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= fs.statSync(srcFile).mtimeMs) return;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(srcFile, outFile);
}

/** 处理一张图片，返回前端需要的信息 */
async function processImage(srcFile, section, slug, kinds) {
  const ext = path.extname(srcFile).toLowerCase();
  const base = slugify(path.basename(srcFile, ext));
  const rel = `media/${section}/${slug}/${base}`;
  const meta = await sharp(srcFile, { failOn: 'none' }).metadata();
  const swap = meta.orientation && meta.orientation >= 5;
  const w = swap ? meta.height : meta.width;
  const h = swap ? meta.width : meta.height;
  const info = { w, h };
  for (const k of kinds) {
    await makeVariant(srcFile, path.join(ROOT, 'public', `${rel}-${k}.webp`), SIZES[k], QUALITY[k]);
    info[k] = `${rel}-${k}.webp`;
  }
  if (kinds.includes('large')) {
    // 保留原图，供“下载”按钮使用
    copyOriginal(srcFile, path.join(ROOT, 'public', `${rel}-original${ext}`));
    info.orig = `${rel}-original${ext}`;
  }
  return info;
}

async function main() {
  const site = readJson(path.join(CONTENT, 'site.json'), {});

  // ---------- 首页 ----------
  const homeDir = path.join(CONTENT, 'home');
  const slides = [];
  for (const f of listImages(homeDir)) {
    const info = await processImage(path.join(homeDir, f), 'home', 'slides', ['hero']);
    slides.push({ src: info.hero, w: info.w, h: info.h });
  }
  let intro = { title: site.title ?? '', html: '' };
  const introFile = path.join(homeDir, 'intro.md');
  if (fs.existsSync(introFile)) {
    const { data, content } = matter(fs.readFileSync(introFile, 'utf8'));
    intro = { title: data.title ?? intro.title, html: marked.parse(content) };
  }

  // ---------- 相册（每个子文件夹 = 一次旅行） ----------
  const galleries = [];
  const galRoot = path.join(CONTENT, 'gallery');
  for (const dir of listDirs(galRoot)) {
    const dirPath = path.join(galRoot, dir);
    const slug = slugify(dir);
    let title = titleFromDir(dir);
    let description = '';
    let bodyHtml = '';
    const infoFile = path.join(dirPath, 'info.md');
    let captions = {};
    if (fs.existsSync(infoFile)) {
      const { data, content } = matter(fs.readFileSync(infoFile, 'utf8'));
      title = data.title ?? title;
      description = data.description ?? '';
      captions = data.captions ?? {};
      bodyHtml = content.trim() ? marked.parse(content) : '';
    }
    const photos = [];
    for (const f of listImages(dirPath)) {
      const info = await processImage(path.join(dirPath, f), 'gallery', slug, ['thumb', 'large']);
      photos.push({ name: f, caption: captions[f] ?? captionFromName(f), ...info });
    }
    galleries.push({ slug, dir, title, description, bodyHtml, photos });
  }

  // ---------- Blog（每个子文件夹 = 一篇文章，内含 index.md） ----------
  const posts = [];
  const blogRoot = path.join(CONTENT, 'blog');
  for (const dir of listDirs(blogRoot)) {
    const dirPath = path.join(blogRoot, dir);
    const mdFile = path.join(dirPath, 'index.md');
    if (!fs.existsSync(mdFile)) continue;
    const slug = slugify(dir);
    const { data, content } = matter(fs.readFileSync(mdFile, 'utf8'));
    let html = marked.parse(content);
    // 把相对路径的图片替换成处理后的图片
    const imgs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^(https?:)?\/\//.test(s) && !s.startsWith('/'));
    for (const s of new Set(imgs)) {
      const file = path.join(dirPath, decodeURIComponent(s));
      if (!fs.existsSync(file)) {
        console.warn(`  ! Blog "${dir}" 引用的图片不存在：${s}`);
        continue;
      }
      const info = await processImage(file, 'blog', slug, ['blog']);
      html = html.split(`src="${s}"`).join(`src="@@BASE@@${info.blog}" width="${info.w}" height="${info.h}" loading="lazy"`);
    }
    const d = data.date ? new Date(data.date) : null;
    posts.push({
      slug,
      dir,
      title: data.title ?? titleFromDir(dir),
      date: d && !isNaN(d) ? d.toISOString().slice(0, 10) : '',
      html,
    });
  }
  // 菜单顺序：按文件夹名排序（想置顶就在文件夹名前加数字）

  fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify({ site, home: { slides, intro }, galleries, posts }, null, 1));

  const nPhotos = galleries.reduce((n, g) => n + g.photos.length, 0);
  console.log(`✔ 首页 ${slides.length} 张 · 相册 ${galleries.length} 个（${nPhotos} 张照片）· Blog ${posts.length} 篇`);
  console.log(`  新生成 ${stats.made} 个图片文件，复用缓存 ${stats.cached} 个`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
