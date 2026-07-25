// 部署方式：
// 1. 建一个新的 Google Sheet（例如叫「500E 反馈记录」）
// 2. 扩展功能 > Apps Script，把这份程式码整份贴进去（盖掉预设内容）
// 3. 建 Sheet 时用 pwu@uswoony.com 登入（跟建筑资料库同一个账号，比较一致）
// 4. 右上角「部署」>「新增部署作业」> 类型选「网页应用程式」
//    - 执行身分：我
//    - 具有存取权的使用者：所有人
// 5. 第一次部署会跳出 Google 授权画面，按流程允许即可
// 6. 部署完会给一个网址（结尾是 /exec），把那个网址丢给 Claude 接到 feedback.html 里
// 7. 之后每次改这份程式码，要「部署」>「管理部署作业」> 编辑（铅笔）> 部署，网址不会变，不用重新接线

const EMAIL_TO = 'pwu@uswoony.com';
const HEADERS = ['时间', '类型', '大楼名称', '问题类型', '区域', '费用', '大楼简介', 'Google Maps', '视频库', '官网', '说明', '反馈人'];

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const mode = (data.mode || '反馈错误').toString();
  const building = (data.building || '未指定').toString();
  const reporter = (data.reporter || '匿名').toString();
  const message = (data.message || '').toString();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('回报') ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('回报');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  let row, emailBody;
  if (mode === '新增/补充资料') {
    const area = (data.area || '').toString();
    const fee = (data.fee || '').toString();
    const notes = (data.notes || '').toString();
    const mapsLink = (data.mapsLink || '').toString();
    const videoLink = (data.videoLink || '').toString();
    const websiteLink = (data.websiteLink || '').toString();
    row = [new Date(), mode, building, '', area, fee, notes, mapsLink, videoLink, websiteLink, message, reporter];
    emailBody = `大楼：${building}\n类型：${mode}\n反馈人：${reporter}\n\n` +
      `区域：${area}\n费用：${fee}\n大楼简介：${notes}\nGoogle Maps：${mapsLink}\n视频库：${videoLink}\n官网：${websiteLink}\n\n其他补充：\n${message}`;
  } else {
    const type = (data.type || '').toString();
    row = [new Date(), mode, building, type, '', '', '', '', '', '', message, reporter];
    emailBody = `大楼：${building}\n类型：${mode}（${type}）\n反馈人：${reporter}\n\n详细说明：\n${message}`;
  }
  sheet.appendRow(row);

  MailApp.sendEmail({
    to: EMAIL_TO,
    subject: `500E ${mode}：${building}`,
    body: emailBody
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
