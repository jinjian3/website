# JinJian's Gallery

纯静态相册网站（Astro + sharp + PhotoSwipe），无数据库、无后台。照片放进文件夹 → 构建 → 上传。

## 目录约定

```
content/
  site.json                  站点标题、网址、社交链接、是否允许下载原图
  home/                      首页幻灯片（按文件名顺序）+ intro.md（向上滑动后显示的说明）
  gallery/
    2007 Xuzhou/             每个文件夹 = 一次旅行 = Gallery 菜单里的一项（按文件夹名排序）
      IMG_A_001.jpg ...      照片按文件名排序
      info.md                可选：标题/简介/每张照片的说明（见下）
  blog/
    2018-german-pork-shank/  每个文件夹 = 一篇文章
      index.md               frontmatter: title, date；正文用 Markdown
      map.jpg                正文里用 ![说明](map.jpg) 引用同目录图片
```

可选的 `info.md`：

```
---
title: 2007 Xuzhou
description: 2007 Caterpillar Xuzhou Project.
captions:
  IMG_A_001.jpg: 酒店大堂
---
```

## 日常流程

```
npm install        # 只需第一次
npm run build      # 生成 dist/（已处理过的图片会走缓存，增量很快）
```

把 `dist/` 里的所有文件 FTP/rsync 到网站根目录即可。本地预览：`npm run dev`。

## 联系表单

服务器需要 PHP。上传后编辑服务器上的 `contact-config.php`，把 `to` 改成你的邮箱。
若收不到邮件，先把 `dry_run` 设为 true 确认表单流程正常（留言会写进 contact-debug.log），再检查服务器 mail() 是否可用。

## 部署在子目录

`BASE=/photos npm run build`
# website
