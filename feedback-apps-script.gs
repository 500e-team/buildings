// 部署方式：
// 1. 建一个新的 Google Sheet（例如叫「500E 反馈记录」）
// 2. 扩展功能 > Apps Script，把这份程式码整份贴进去（盖掉预设内容）
// 3. 上面 EMAIL_TO 改成你要收信的 Gmail（默认已经是 ianwu0415123@gmail.com）
// 4. 右上角「部署」>「新增部署作业」> 类型选「网页应用程式」
//    - 执行身分：我
//    - 具有存取权的使用者：所有人
// 5. 第一次部署会跳出 Google 授权画面，按流程允许即可
// 6. 部署完会给一个网址（结尾是 /exec），把那个网址丢给 Claude 接到 feedback.html 里

const EMAIL_TO = 'ianwu0415123@gmail.com';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const building = (data.building || '未指定').toString();
  const type = (data.type || '').toString();
  const message = (data.message || '').toString();
  const reporter = (data.reporter || '匿名').toString();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('回报') ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('回报');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['时间', '大楼名称', '问题类型', '详细说明', '反馈人']);
  }
  sheet.appendRow([new Date(), building, type, message, reporter]);

  MailApp.sendEmail({
    to: EMAIL_TO,
    subject: `500E 反馈：${building}`,
    body: `大楼：${building}\n类型：${type}\n反馈人：${reporter}\n\n详细说明：\n${message}`
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
