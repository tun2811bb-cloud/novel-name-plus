import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEntry,normalizeSuffix,containsHan,qualitySummary} from '../src/quality.mjs';
import {normalizeName,parseNameTxt,exportClean,exportGrouped,mergeEntries} from '../src/core.mjs';

test('hậu tố luôn đứng sau tên và viết thường trong tên người',()=>{
  const examples=[
    ['白长老','Bạch Trưởng Lão','TITLE','Bạch trưởng lão'],
    ['林大公子','Lâm Đại Công Tử','TITLE','Lâm đại công tử'],
    ['洛小姐','Lạc Tiểu Thư','TITLE','Lạc tiểu thư'],
    ['幽冥公主','U Minh Công Chúa','TITLE','U Minh công chúa'],
    ['顾列车长','Cố Liệt Xa Trưởng','TITLE','Cố trưởng tàu'],
    ['洛秋雪姐姐','Lạc Thu Tuyết Tỷ Tỷ','ALIAS','Lạc Thu Tuyết tỷ tỷ'],
  ];
  for(const [zh,vi,category,expected] of examples) assert.equal(assessEntry({zh,vi,category}).vi,expected,zh);
});
test('tên địa danh ngoại lệ, không đổi hậu tố',()=>{
  assert.equal(assessEntry({zh:'柯北城机场',vi:'Sân bay Kha Bắc Thành',category:'LOCATION'}).vi,'Sân bay Kha Bắc Thành');
});
test('không tự đảo danh xưng đầu câu khi không biết gốc',()=>{
  const e=assessEntry({zh:'黄老师',vi:'Thầy Hoàng',category:'PERSON'});
  assert.equal(e.status,'review');assert.equal(e.vi,'Thầy Hoàng');
});
test('loại số hiệu chức vụ, từ phổ thông và giữ phẩm cấp dạng thuật ngữ',()=>{
  for(const zh of ['第八队长','九号队长','八长老'])assert.equal(assessEntry({zh,vi:'Tạm dịch',category:'TITLE'}).status,'omit');
  for(const zh of ['控制','感知','蜘蛛网','列车厕所'])assert.equal(assessEntry({zh,vi:'Tạm dịch',category:'SKILL'}).status,'omit');
  assert.equal(assessEntry({zh:'王者级',vi:'Vương Giả Cấp',category:'REALM'}).status,'term');
});
test('không cho chữ Han còn sót lọt qua xuất TXT',()=>{
  const e=normalizeName({zh:'莉莉',vi:'L莉',category:'PERSON'},'莉莉');
  assert.equal(e.status,'review');assert.ok(e.issues.length);
  assert.equal(containsHan(e.vi),true);
  const override={...e,status:'keep',manualStatus:true};
  assert.equal(assessEntry(override).status,'review');
  assert.equal(exportClean([override]),'\n');
});
test('tên quốc tế được gắn cờ nếu chưa duyệt; không đoán tên Latin',()=>{
  const e=normalizeName({zh:'蛮斯格',vi:'Man Tư Cách',category:'PERSON',origin:'foreign'},'蛮斯格');
  assert.equal(e.status,'review');assert.equal(e.vi,'Man Tư Cách');
  assert.equal(exportClean([e]),'\n');
  e.manualStatus=true;e.status='keep';assert.equal(exportClean([e]),'\n');
  assert.equal(assessEntry(e).status,'review','không cho phép ép giữ bằng thao tác cũ');
});
test('parse file NAME cũ giữ nhóm, chặn mục rủi ro nhưng không xóa khỏi bảng rà soát',()=>{
  const text='# Danh xưng / chức vụ (2)\n白长老=Bạch Trưởng Lão\n第八队长=Đệ Bát Đội Trưởng\n# Nhân vật (1)\n莉莉=L莉\n';
  const got=parseNameTxt(text);assert.equal(got.length,3);assert.equal(got[0].category,'TITLE');
  const quality=qualitySummary(got);assert.equal(quality.keep,1);assert.equal(quality.omit,1);assert.equal(quality.review,1);
  assert.equal(exportClean(got),'白长老=Bạch trưởng lão\n');
  assert.ok(!exportGrouped(got).includes('莉莉'));
});
test('xung đột dịch vẫn ghi nhận và thay thế bản còn Han nếu có bản sạch',()=>{
  const old=[{zh:'莉莉',vi:'L莉',category:'PERSON',status:'review'}];
  const items=mergeEntries(old,[{zh:'莉莉',vi:'Lị Lị',category:'PERSON'}],'莉莉');
  assert.equal(items[0].vi,'Lị Lị');assert.equal(items[0].status,'review','sửa hết chữ Hán chưa đủ để xác minh tên nghi quốc tế');
  assert.ok(items[0].alternatives.includes('L莉'));
});

test('tên quốc tế đã biết dùng Latin, không bị Hán Việt hóa',()=>{
  for(const [zh,vi] of [['杰克','Jack'],['杰森','Jason'],['汉尼拔','Hannibal'],['马丁','Martin']]){
    const e=assessEntry({zh,vi,category:'PERSON',origin:'unknown'});
    assert.equal(e.status,'keep',zh);assert.equal(e.internationalVerified,true);
    assert.ok(exportClean([e]).includes(zh+'='+vi));
  }
  assert.equal(assessEntry({zh:'杰克',vi:'Kiệt Khắc',category:'PERSON',manualStatus:true,status:'keep'}).status,'review');
});
test('phát hiện quốc tế khi AI gán sai origin=domestic',()=>{
  const risky=[['顿克斯','Đốn Khắc Tư'],['费罗恩','Phí La Ân'],['蛮斯格','Man Tư Cách'],['休斯格','Hưu Tư Cách'],['罗斯杰','La Tư Kiệt'],['科娃','Khoa Oa']];
  for(const [zh,vi] of risky){
    const e=assessEntry({zh,vi,category:'PERSON',origin:'domestic',manualStatus:true,status:'keep'});
    assert.equal(e.status,'review',zh);
    assert.equal(exportClean([e]),'\n',zh);
  }
});
test('chỉ xác minh Latin có sự đồng ý rõ ràng',()=>{
  const source={zh:'顿克斯',vi:'Tonks',category:'PERSON',origin:'foreign'};
  assert.equal(assessEntry(source).status,'review');
  const checked=assessEntry({...source,originConfirmed:true,foreignVerified:true});
  assert.equal(checked.status,'keep');
  assert.ok(exportClean([checked]).includes('顿克斯=Tonks'));
  const changed=assessEntry({...source,vi:'Đốn Khắc Tư',originConfirmed:true,foreignVerified:true,manualStatus:true,status:'keep'});
  assert.equal(changed.status,'review');
});
test('người biên tập có thể xác nhận tên Trung dù mẫu chữ khả nghi',()=>{
  const entry=assessEntry({zh:'罗斯杰',vi:'La Tư Kiệt',category:'PERSON',origin:'domestic',originConfirmed:true});
  assert.equal(entry.internationalSuspect,false);
  assert.equal(entry.status,'keep');
});
