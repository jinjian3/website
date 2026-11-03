<?php
// 联系表单设置 —— 部署后请把 to 改成你自己的邮箱
return [
  'to' => 'you@example.com',                 // 收件邮箱（你自己的）
  'from' => 'JinJian Gallery <noreply@jinjian.net>', // 发件人；域名最好是你网站自己的域名，否则容易进垃圾箱
  'subject_prefix' => '[Gallery 留言] ',
  'dry_run' => false,                        // true = 只写日志 contact-debug.log，不真正发邮件（调试用）
];
