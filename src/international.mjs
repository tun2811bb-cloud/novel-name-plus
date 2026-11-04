/** Conservative international-name policy for Quick Translator.
 * A possible foreign name MUST NOT silently become a Hán–Việt NAME.
 * Ambiguity goes to human review; the program never invents Latin spellings.
 */
const confirmed = new Map([
  ['杰克', 'Jack'], ['杰森', 'Jason'], ['汉尼拔', 'Hannibal'], ['马丁', 'Martin'],
]);
const suspiciousExact = new Set([
  '顿克斯','费罗恩','蛮斯格','休斯格','罗斯杰','科娃','罗恩','耶格','吉克','莉莉',
]);
const phoneticSuffix = /(?:克斯|斯格|罗恩|斯基|维奇|科娃|丽莎|米娅|玛丽|约翰|安娜|妮娜|索菲|凯文|罗伯特|亚当|卡尔|托尼|莱恩|罗斯)$/u;
const mixedPhonetics = /(?:罗斯.{1,2}|.{1,2}斯杰|.{1,3}克斯|.{1,3}斯格)$/u;
const latinName = /^[\p{Script=Latin}\p{M}][\p{Script=Latin}\p{M} .’'\-]{0,99}$/u;
const hanVietnameseSyllables = new Set([
  'đốn','khắc','tư','cách','hưu','khoa','oa','kiệt','ân','phí','cát','la','đại','thiên','long',
  'hàn','lân','lôi','sơn','vũ','thần','tư','khải','đạt','giả','lệ','miểu','nguyên','hạo',
]);
export const confirmedForeignNames = Object.freeze(Object.fromEntries(confirmed));

export function isLikelyHanVietSpelling(value) {
  const words = String(value ?? '').normalize('NFC').trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length < 2) return false;
  return words.filter(w => hanVietnameseSyllables.has(w)).length >= 2;
}
export function isLatinName(value) {
  return latinName.test(String(value ?? '').normalize('NFC').trim());
}
/** Non-person categories are not guessed from suffix shapes. Explicit AI/human origin still applies. */
export function internationalEvidence(entry) {
  const zh = String(entry.zh ?? '');
  const vi = String(entry.vi ?? '');
  const category = String(entry.category ?? '');
  const canonical = confirmed.get(zh) || null;
  const fromSource = entry.origin === 'foreign' || entry.isForeign === true;
  const suggested = (category === 'PERSON' || category === 'ALIAS') &&
    (suspiciousExact.has(zh) || (zh.length >= 3 && zh.length <= 8 && (phoneticSuffix.test(zh) || mixedPhonetics.test(zh))));
  // A reader's explicit origin decision can resolve a heuristic ambiguity, but
  // it cannot override a verified transliteration pair or the no-Han rule.
  const domesticVerified = entry.originConfirmed === true && entry.origin === 'domestic' && !canonical;
  const isForeign = Boolean(canonical || (!domesticVerified && (fromSource || suggested)));
  const exactStandard = Boolean(canonical && vi === canonical);
  const latin = isLatinName(vi);
  const hV = isLikelyHanVietSpelling(vi);
  const humanApproved = entry.foreignVerified === true && entry.originConfirmed === true && entry.origin === 'foreign';
  const verified = isForeign && (exactStandard || (humanApproved && latin && !hV));
  return {
    isForeign, verified, canonical, latin, hV,
    ambiguous: Boolean(suggested && !canonical && !domesticVerified),
    reason: !isForeign ? null :
      hV ? 'Tên nghi quốc tế còn phiên âm Hán Việt; không được xuất NAME sạch.' :
      !latin ? 'Tên nghi quốc tế chưa có cách viết Latin hợp lệ.' :
      !verified ? 'Tên nghi quốc tế chưa xác minh cách viết gốc; cần duyệt thủ công.' : null,
  };
}
