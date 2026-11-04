import {internationalEvidence} from "./international.mjs";
export {internationalEvidence,isLatinName,isLikelyHanVietSpelling,confirmedForeignNames} from "./international.mjs";
/** Deterministic, conservative QA for Quick Translator NAME. No network calls. */
export const QUALITY_STATUSES = Object.freeze([
  ['keep', 'NAME chính thức'],
  ['term', 'Thuật ngữ (không xuất mặc định)'],
  ['review', 'Cần rà soát'],
  ['omit', 'Loại khỏi NAME'],
]);
const validStatuses = new Set(QUALITY_STATUSES.map(row => row[0]));
const containsHan = value => /\p{Script=Han}/u.test(String(value ?? ''));
export {containsHan};

// Terms that do not identify a unique person, place or artefact on their own.
const genericActions = new Set([
  '控制','感知','洞察','提示','偷听','治疗','净化','时停','水晶','鬼化','虚化',
  '取消限制','选择车站','美食制作','高级铁傀儡制作','强化美食制作',
]);
const genericThings = new Set([
  '蜘蛛网','腐肉','列车厕所','列车空调','列车方向盘','面包机图纸',
  '普通宝箱','黄金宝箱','白银宝箱','青铜宝箱','彩色','列车长','队长',
]);
const ordinaryCreature = new Set(['巨人','巨魔','牛头','冰熊','蛟蛇','石头人','高级丧尸','低级生化人']);
const numericRole = /^(?:第[零〇一二两三四五六七八九十百千万亿\d]+|[零〇一二两三四五六七八九十百千万亿\d]+号?)(?:副?队长|长老|军团|等猎龙者|等官|号队长)$/u;
const rankGrade = /(?:极品|上品|中品|下品|品质|级)$/u;
const genericItem = /(?:制作图纸|图纸|升级卡|招募卡|招募卷轴|召唤卷轴|身份证|身份卡|宝箱|车厢|按钮|探测仪|检测仪|凝水器|电冰箱|冰箱|大床|风衣|夹克|药剂|注射剂|种子|列车币|求生币|升级币|护甲|防弹衣)$/u;
const genericTitle = /^(?:队长|副队长|长老|老师|会长|小姐|公子|公主|列车长|猎杀者|圣女|大人|先生|界主)$/u;

// Sort by longest suffix first to avoid detecting 哥 inside 哥哥, etc.
const suffixRules = [
  [/列车长$/u, /(?:Liệt\s*[Xx]a\s*[Tt]rưởng|[Tt]rưởng\s*[Tt]àu)$/u, 'trưởng tàu'],
  [/副队长$/u, /[Pp]hó\s+[Đđ]ội\s+[Tt]rưởng$/u, 'phó đội trưởng'],
  [/大公子$/u, /[Đđ]ại\s+[Cc]ông\s+[Tt]ử$/u, 'đại công tử'],
  [/队长$/u, /[Đđ]ội\s+[Tt]rưởng$/u, 'đội trưởng'],
  [/长老$/u, /[Tt]rưởng\s+[Ll]ão$/u, 'trưởng lão'],
  [/公子$/u, /[Cc]ông\s+[Tt]ử$/u, 'công tử'],
  [/公主$/u, /[Cc]ông\s+[Cc]húa$/u, 'công chúa'],
  [/小姐$/u, /[Tt]iểu\s+[Tt]hư$/u, 'tiểu thư'],
  [/会长$/u, /[Hh]ội\s+[Tt]rưởng$/u, 'hội trưởng'],
  [/先生$/u, /[Tt]iên\s+[Ss]inh$/u, 'tiên sinh'],
  [/老师$/u, /[Ll]ão\s+[Ss]ư$/u, 'lão sư'],
  [/大人$/u, /[Đđ]ại\s+[Nn]hân$/u, 'đại nhân'],
  [/姐姐$/u, /[Tt]ỷ\s+[Tt]ỷ$/u, 'tỷ tỷ'],
  [/哥哥$/u, /[Cc]a\s+[Cc]a$/u, 'ca ca'],
  [/太子$/u, /[Tt]hái\s+[Tt]ử$/u, 'thái tử'],
  [/姐$/u, /[Tt]ỷ$/u, 'tỷ'],
  [/哥$/u, /[Cc]a$/u, 'ca'],
];
const suffixExceptions = new Set(['秦始皇','汉高祖','汉太祖','齐太祖']);
/** Keep Chinese order: surname/name + lowercase suffix; never swap title before name. */
export function normalizeSuffix(zh, vi, category) {
  if (!['TITLE','ALIAS','PERSON'].includes(category) || suffixExceptions.has(zh)) return {vi, issue:null};
  for (const [chinese, vietnamese, replacement] of suffixRules) {
    if (!chinese.test(zh)) continue;
    if (vietnamese.test(vi)) {
      const base = vi.replace(vietnamese,'').trim();
      if (!base) return {vi, issue:null};
      return {vi: `${base} ${replacement}`, issue:null};
    }
    // Never silently reverse a title-first translation: the prefix is unknown.
    return {vi, issue:'Danh xưng/hậu tố chưa đúng thứ tự hoặc cách dịch; cần kiểm tra.'};
  }
  return {vi, issue:null};
}

/** The quality gate applies even to manually accepted/legacy entries. */
export function assessEntry(input, {preserveManual=true}={}) {
  const entry = {...input};
  entry.zh=String(entry.zh??'').trim();
  entry.vi=String(entry.vi??'').trim();
  entry.category=String(entry.category??'OTHER').toUpperCase();
  const issues=[];
  const normalized=normalizeSuffix(entry.zh,entry.vi,entry.category);
  entry.vi=normalized.vi;
  if(normalized.issue)issues.push(normalized.issue);
  if(containsHan(entry.vi))issues.push('Bản Việt còn ký tự Hán: không được xuất Quick Translator.');
  if(/[=\r\n]/u.test(entry.vi))issues.push('Bản Việt chứa dấu bằng hoặc xuống dòng không hợp lệ.');
  if (!entry.vi) issues.push('Thiếu bản dịch tiếng Việt.');

  let status='keep';
  if(numericRole.test(entry.zh)) {status='omit';issues.push('Chức vụ theo số hiệu/thứ tự, không phải tên riêng.');}
  else if(genericTitle.test(entry.zh)) {status='omit';issues.push('Chức danh phổ thông đứng một mình.');}
  else if(genericActions.has(entry.zh)||genericThings.has(entry.zh)) {status='omit';issues.push('Từ phổ thông, thao tác hoặc vật phẩm mô tả.');}
  else if(entry.category==='REALM' || rankGrade.test(entry.zh) && ['CREATURE','ITEM','OTHER'].includes(entry.category)) {
    status='term';issues.push('Cấp bậc/phẩm chất: đưa vào từ điển thuật ngữ nếu cần.');
  }
  else if(entry.category==='CREATURE'&&ordinaryCreature.has(entry.zh)) {
    status='term';issues.push('Tên giống loài phổ thông, không phải cá thể riêng.');
  }
  else if(entry.category==='ITEM' && genericItem.test(entry.zh)) {
    status='term';issues.push('Tên loại vật phẩm/bản vẽ, cần quyết định có tạo thuật ngữ.');
  }
  else if(entry.category==='BOOK' && /^(?:双人宿舍|双人楼梯|双人方块)$/u.test(entry.zh)) {
    status='review';issues.push('Mục được xếp là kinh thư nhưng có vẻ là tên công trình/tính năng.');
  }
  else if(entry.category==='TITLE' && /^(?:大长老|十大队长|列车长大人|特等猎龙者|前辈猎杀者)$/u.test(entry.zh)) {
    status='term';issues.push('Danh xưng chung hoặc cấp bậc, không mặc định coi là NAME.');
  }
  else if(entry.category==='SKILL' && entry.zh.length<=2) {
    status='review';issues.push('Kỹ năng rất ngắn, có thể trùng động từ phổ thông.');
  }
  if(entry.type==='term' && status==='keep'){status='term';issues.push('AI đánh dấu là thuật ngữ, không phải NAME độc lập.');}
  if(entry.type==='generic' && status==='keep'){status='omit';issues.push('AI đánh dấu từ hoặc cụm từ phổ thông.');}
  const intl=internationalEvidence(entry);
  entry.internationalSuspect=intl.isForeign;
  entry.internationalVerified=intl.verified;
  if(intl.isForeign && !intl.verified){
    if(status==='keep' || status==='term')status='review';
    if(intl.reason)issues.push(intl.reason);
  }
  if(normalized.issue && status==='keep')status='review';
  if(preserveManual && entry.manualStatus && validStatuses.has(entry.status)) status=entry.status;
  // Absolute blockers: even a manually forced KEEP must not bypass international QA.
  if(containsHan(entry.vi)||/[=\r\n]/u.test(entry.vi)||!entry.vi || (intl.isForeign && !intl.verified))status='review';
  entry.status=status;
  entry.issues=[...new Set(issues)];
  return entry;
}
export function validForExport(entry, includeTerms=false){
  return (entry.status==='keep'||includeTerms&&entry.status==='term') &&
    Boolean(entry.zh&&entry.vi) && !containsHan(entry.vi) && !/[=\r\n]/u.test(entry.vi) &&
    (!internationalEvidence(entry).isForeign || internationalEvidence(entry).verified);
}
export function qualitySummary(entries){
  const tally={keep:0,term:0,review:0,omit:0,invalid:0};
  for(const item of entries){const e=assessEntry(item);tally[e.status]++;if(containsHan(e.vi)||!e.vi)tally.invalid++;}
  return tally;
}
