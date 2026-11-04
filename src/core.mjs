/** Pure local text parsing and Quick Translator export, no network access. */
export const CATEGORIES = Object.freeze([
  ['PERSON','Nhân vật'],['ALIAS','Biệt danh / tên gọi'],['TITLE','Danh xưng / chức vụ'],
  ['DAO_NAME','Đạo hiệu / thần hiệu / tôn hiệu'],['LOCATION','Địa danh / thế giới'],
  ['FACTION','Tổ chức / môn phái / thế lực'],['SKILL','Công pháp / võ kỹ'],
  ['SPELL','Pháp thuật / thần thông'],['REALM','Cảnh giới / cấp bậc'],
  ['CREATURE','Sinh vật / yêu thú'],['PLANT','Thực vật / linh dược'],
  ['ITEM','Vật phẩm / pháp bảo'],['BOOK','Kinh thư / điển tịch'],['OTHER','Khác']
]);
const categorySet = new Set(CATEGORIES.map(x=>x[0]));
const cn = /[\u3400-\u9fff]/u;
const title = /^\s*第\s*(?:[零〇一二两三四五六七八九十百千万亿\d]+)\s*[章回节]\s*[^\n]{0,90}$/u;

export function normalizeText(text) { return String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'); }
export function isHeading(line) { return title.test(line); }
export function splitChapters(raw) {
  const text = normalizeText(raw);
  const lines = text.split('\n');
  const units = [];
  let current = {heading:'Phần mở đầu', text:''};
  for (const line of lines) {
    if (isHeading(line) && current.text.trim()) { units.push(current); current = {heading:line.trim(),text:''}; }
    else if (isHeading(line)) current.heading=line.trim();
    current.text += line+'\n';
  }
  if (current.text.trim()) units.push(current);
  return units;
}
export function buildChunks(text, limit=6300) {
  if (!Number.isInteger(limit) || limit<500) throw new Error('Giới hạn đoạn không hợp lệ');
  const chapters = splitChapters(text), chunks = [];
  const push = (s, heading) => { if (s.trim()) chunks.push({heading, text:s.trim()}); };
  let buf='', names=[];
  for (const chapter of chapters) {
    const body = chapter.text;
    if (buf.length+body.length<=limit) {
      buf += (buf?'\n':'')+body;
      names.push(chapter.heading);
      continue;
    }
    if (buf) { push(buf,names.join(' · ')); buf=''; names=[]; }
    if (body.length<=limit) {buf=body;names=[chapter.heading];continue;}
    const paragraphs = body.split(/(?<=\n)/u);
    let part='';
    for (let p of paragraphs) {
      while(p.length>limit) {
        if(part) {push(part,chapter.heading);part='';}
        let cut=p.lastIndexOf('。',limit);
        if(cut<limit/2) cut=p.lastIndexOf('，',limit);
        if(cut<limit/2) cut=limit-1;
        else cut++;
        push(p.slice(0,cut),chapter.heading);p=p.slice(cut);
      }
      if(part.length+p.length>limit) {push(part,chapter.heading);part='';}
      part+=p;
    }
    if(part) push(part,chapter.heading);
  }
  if(buf)push(buf,names.join(' · '));
  return chunks;
}
export function normalizeName(record, originalChunk='') {
  if(!record || typeof record!=='object')return null;
  const zh=String(record.zh??record.chinese??'').trim().replace(/[=\r\n\t]/g,'');
  const vi=String(record.vi??record.vietnamese??'').trim().replace(/[=\r\n\t]/g,'');
  const cat=String(record.category??'OTHER').trim().toUpperCase();
  if(!zh||!vi||zh.length>48||vi.length>110||!cn.test(zh))return null;
  if(originalChunk && !originalChunk.includes(zh))return null;
  if(/^[\p{P}\p{S}\d\s]+$/u.test(vi))return null;
  return {zh,vi,category:categorySet.has(cat)?cat:'OTHER', count:1, reviewed:false};
}
export function mergeEntries(existing,newRecords,chunk='') {
  const map=new Map(existing.map(x=>[x.zh,{...x}]));
  for(const item of newRecords) {
    const e=normalizeName(item,chunk);if(!e)continue;
    const prev=map.get(e.zh);
    if(prev) {
      prev.count=(prev.count||1)+1;
      if(prev.vi!==e.vi)prev.alternatives=[...new Set([...(prev.alternatives||[]),e.vi])];
    } else map.set(e.zh,e);
  }
  return [...map.values()];
}
export function parseAIResult(raw) {
  let text=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;
  try {parsed=JSON.parse(text);} catch {
    const from=text.indexOf('{'),to=text.lastIndexOf('}');
    if(from<0||to<=from) throw new Error('AI chưa trả JSON hợp lệ; đoạn này cần thử lại.');
    parsed=JSON.parse(text.slice(from,to+1));
  }
  const entries=Array.isArray(parsed)?parsed:parsed?.names;
  if(!Array.isArray(entries))throw new Error('Thiếu mảng names trong kết quả AI.');
  return entries;
}
export function sortedEntries(entries) {
  return [...entries].filter(x=>x.zh&&x.vi).sort((a,b)=> b.zh.length-a.zh.length||a.zh.localeCompare(b.zh,'zh'));
}
export function exportClean(entries) {return sortedEntries(entries).map(x=>`${x.zh}=${x.vi}`).join('\n')+'\n';}
export function exportGrouped(entries) {
  const rows=[];
  for(const [key,label] of CATEGORIES) {
    const group=sortedEntries(entries.filter(x=>x.category===key));
    if(!group.length)continue;
    rows.push(`# ${label} (${group.length})`);
    for(const item of group)rows.push(`${item.zh}=${item.vi}`);
    rows.push('');
  }
  return rows.join('\n').trimEnd()+'\n';
}
export function safeFilename(name){return String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,90)||'novel';}
