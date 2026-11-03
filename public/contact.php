<?php
// 联系表单：接收浏览者的姓名/邮箱/留言，用邮件发给站长。
// 先修改同目录的 contact-config.php 里的收件邮箱。
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($ok, $error = null, $code = 200) {
  http_response_code($code);
  echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 'Method not allowed', 405);

$cfg = require __DIR__ . '/contact-config.php';

// 蜜罐：机器人会填这个隐藏字段；假装成功
if (!empty($_POST['website'])) out(true);
// 过快提交（< 2 秒）多半是机器人
if (isset($_POST['t']) && (int)$_POST['t'] < 2000) out(false, '提交太快了，请稍后再试', 429);

$clean = function ($s, $max) {
  $s = trim((string)$s);
  $s = str_replace("\0", '', $s);
  return mb_substr($s, 0, $max);
};
$name = $clean($_POST['name'] ?? '', 80);
$email = $clean($_POST['email'] ?? '', 120);
$message = $clean($_POST['message'] ?? '', 4000);

if ($name === '' || $message === '') out(false, '请填写姓名和内容', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(false, '邮箱格式不正确', 422);
// 防邮件头注入：姓名/邮箱不允许含换行
if (preg_match('/[\r\n]/', $name . $email)) out(false, '输入内容不合法', 422);

// 简单限流：同一 IP 每分钟最多 3 封
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/jj_contact_' . md5($ip);
$hits = [];
if (is_file($rateFile)) $hits = array_filter(array_map('intval', explode(',', (string)file_get_contents($rateFile))), fn($t) => $t > time() - 60);
if (count($hits) >= 3) out(false, '发送太频繁，请一分钟后再试', 429);
$hits[] = time();
@file_put_contents($rateFile, implode(',', $hits));

$subject = '=?UTF-8?B?' . base64_encode($cfg['subject_prefix'] . $name) . '?=';
$body = "姓名: $name\r\n邮箱: $email\r\nIP: $ip\r\n时间: " . date('Y-m-d H:i:s') . "\r\n\r\n$message\r\n";
$headers = [
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'From: ' . $cfg['from'],
  'Reply-To: ' . $name . ' <' . $email . '>',
];

if (!empty($cfg['dry_run'])) { // 调试：不发邮件，写入日志
  @file_put_contents(__DIR__ . '/contact-debug.log', "---\r\n$body", FILE_APPEND);
  out(true);
}
$sent = @mail($cfg['to'], $subject, $body, implode("\r\n", $headers));
if (!$sent) out(false, '邮件发送失败，请稍后再试', 500);
out(true);
