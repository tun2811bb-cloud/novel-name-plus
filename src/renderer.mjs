import {CATEGORIES,buildChunks,splitChapters,mergeEntries,parseAIResult,exportClean,exportGrouped,safeFilename} from './core.mjs';
const byId = id=>document.getElementById(id);
const api=window.namePlus;
let raw='', fileName='', chunks=[], chapters=[], key='', entries=[], done=new Set(), audited=new Set();
let processing=false, stopRequested=false, phase='extract', logged=[], session={status:'disconnected',sharing:false};
const categoryLabel=Object.fromEntries(CATEGORIES);

function number(n){return Number(n||0).toLocaleString('vi-VN');}
function notify(msg){const node=document.createElement('div');node.className='toastItem';node.textContent=msg;byId('toast').append(node);setTimeout(()=>node.remove(),5200);}
function log(msg){logged.unshift(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);logged=logged.slice(0,9);byId('logLines').textContent=logged.join('\n');}
function setPhase(text){byId('phase').textContent=text;}
function switchPage(page){document.querySelectorAll('.page').forEach(n=>n.classList.toggle('hidden',n.id!==page));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.target===page));if(page==='results')renderTable();}
document.querySelectorAll('.nav').forEach(n=>n.addEventListener('click',()=>switchPage(n.dataset.target)));

function hash(str){let h=0xcbf29ce484222325n;const prime=0x100000001b3n;for(let i=0;i<str.length;i++){h^=BigInt(str.charCodeAt(i));h=BigInt.asUintN(64,h*prime);}return h.toString(16).padStart(16,'0');}
async function setStory(text,name){
 if(processing){notify('Hãy tạm dừng quét trước khi đổi truyện.');return;}
 raw=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');fileName=name;chapters=splitChapters(raw);
 chunks=buildChunks(raw,Number(byId('chunkSize').value));key='p_'+hash(raw+'|'+byId('chunkSize').value);
 entries=[];done=new Set();audited=new Set();phase='extract';
 byId('filename').textContent=name;
 byId('fileStats').textContent=`${number(raw.length)} ký tự · ${number(chapters.filter(c=>/^第/.test(c.heading)).length)} chương`;
 byId('fileInfo').classList.remove('hidden');
 try {const saved=await api.loadProject(key);if(saved&&saved.version===1&&Array.isArray(saved.entries)){
   entries=saved.entries;done=new Set(saved.done||[]);audited=new Set(saved.audited||[]);log(`Đã khôi phục ${number(done.size)} đoạn đã quét và ${number(entries.length)} NAME.`);
 }}catch(e){log('Không thể nạp tiến độ: '+e.message);}
 log(`Đã nạp ${name}, chia ${number(chunks.length)} đoạn.`);update();
}
async function readFile(file){
 if(!file){return;}
 const buf=await file.arrayBuffer();let content;
 try{content=new TextDecoder('utf-8',{fatal:true}).decode(buf);}catch{content=new TextDecoder('gb18030').decode(buf);}
 await setStory(content,file.name);
}
byId('fileInput').addEventListener('change',e=>readFile(e.target.files?.[0]).catch(err=>notify(err.message)));
const drop=byId('dropzone');
for(const name of ['dragover','dragenter'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');});
drop.addEventListener('drop',e=>readFile(e.dataTransfer.files?.[0]).catch(err=>notify(err.message)));
byId('usePaste').addEventListener('click',()=>{const t=byId('pasteBox').value;if(!t.trim()){notify('Chưa có văn bản để nạp.');return;}setStory(t,'Văn bản dán.txt').catch(e=>notify(e.message));});
byId('chunkSize').addEventListener('change',()=>{if(raw)setStory(raw,fileName).catch(e=>notify(e.message));});

async function refreshAuth(){
 try{session=await api.session();byId('authIndicator').textContent=session.sharing?'Đã dùng quyền Plus':session.status==='connected'?'Đã đăng nhập (chưa cấp quyền)':'Chưa kết nối';
 byId('authIndicator').className='pill '+(session.sharing?'connected':'');
 byId('accountName').textContent=session.identity?.email||session.profileLabel|| (session.status==='connected'?'Tài khoản đã kết nối':'Chưa đăng nhập');
 byId('accountHint').textContent=session.sharing?'Đã cấp quyền sử dụng ChatGPT plan':session.error?.message||'Cần cho phép dùng gói ChatGPT để quét NAME.';
 byId('login').textContent=session.sharing?'Đăng nhập lại / cấp quyền':'Tiếp tục với ChatGPT';
 byId('logout').classList.toggle('hidden',session.status!=='connected');
 if(session.sharing){const models=await api.models();const previous=byId('model').value;byId('model').replaceChildren();
   if(!models.length){const o=document.createElement('option');o.textContent='Không có mô hình khả dụng';o.value='';byId('model').append(o);}
   for(const m of models){const option=document.createElement('option');option.value=m.slug;option.textContent=m.displayName||m.slug;byId('model').append(option);}
   if(models.some(x=>x.slug===previous))byId('model').value=previous;
 }else{byId('model').replaceChildren(new Option('Hãy đăng nhập trước',''));}
 }catch(e){log('Lỗi kết nối: '+e.message);}
 update();
}
byId('login').addEventListener('click',async()=>{byId('login').disabled=true;byId('accountHint').textContent='Đang mở trình duyệt để xác thực…';
 try{await api.signIn();log('Đăng nhập ChatGPT hoàn tất.');}catch(e){notify(e.message);log('Đăng nhập chưa thành công: '+e.message);}finally{byId('login').disabled=false;await refreshAuth();}});
byId('logout').addEventListener('click',async()=>{try{await api.signOut();await refreshAuth();}catch(e){notify(e.message);}});
byId('usage').addEventListener('click',()=>api.usage());

async function save(){if(!key)return;await api.saveProject(key,{version:1,fileName,entries,done:[...done],audited:[...audited],savedAt:new Date().toISOString()});}
function update(){
 const total=chunks.length, finished=phase==='audit'?audited.size:done.size,pct=total?Math.round(100*finished/total):0;
 byId('chapters').textContent=number(chapters.filter(c=>/^第/.test(c.heading)).length);
 byId('parts').textContent=number(total);byId('names').textContent=number(entries.length);
 byId('progressPct').textContent=pct+'%';byId('progressFill').style.width=pct+'%';
 byId('progressText').textContent=total?`${phase==='audit'?'Lượt rà soát':'Lượt trích xuất'} · ${number(finished)}/${number(total)} đoạn`:'Hãy chọn truyện để bắt đầu.';
 byId('start').disabled=!raw||!session.sharing||!byId('model').value||processing;
 byId('pause').disabled=!processing;byId('audit').disabled=!raw||!session.sharing||processing||done.size!==total||total===0;
 byId('exportGrouped').disabled=entries.length===0;byId('exportClean').disabled=entries.length===0;
 byId('resultCount').textContent=`${number(entries.length)} mục`;setPhase(processing?'Đang quét':(!raw?'Chờ tệp':(done.size===total?'Đã quét lượt một':'Sẵn sàng')));
 if(!document.getElementById('results').classList.contains('hidden'))renderTable();
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(mode){
 if(processing||!raw)return;
 if(!session.sharing){notify('Bạn chưa cấp quyền sử dụng ChatGPT plan.');return;}
 const model=byId('model').value;if(!model){notify('Chọn mô hình AI trước.');return;}
 processing=true;stopRequested=false;phase=mode;update();
 const completed=mode==='audit'?audited:done;
 log(mode==='audit'?'Bắt đầu rà lượt hai.':'Bắt đầu trích xuất NAME.');
 try{
 for(let i=0;i<chunks.length;i++){
   if(stopRequested)break;
   if(completed.has(i))continue;
   const chunk=chunks[i];const known=entries.filter(x=>chunk.text.includes(x.zh)).slice(0,45);
   log(`Đoạn ${i+1}/${chunks.length} · ${chunk.heading.slice(0,60)}`);
   let ok=false;
   for(let attempt=1;attempt<=3 && !stopRequested;attempt++) {
     try{
       const result=await api.extract(chunk.text,model,mode,known);
       const found=parseAIResult(result);
       const before=entries.length;
       entries=mergeEntries(entries,found,chunk.text);
       completed.add(i);
       await save();
       log(`Hoàn tất đoạn ${i+1}: ${found.length} mục AI, +${entries.length-before} khóa mới.`);
       ok=true;break;
     } catch(e) {
       if(stopRequested)break;
       const msg=String(e.message||e);
       log(`Đoạn ${i+1} thất bại (${attempt}/3): ${msg.slice(0,180)}`);
       if(/limit|quota|429|permission|401|403|consent|sign.in|sharing/i.test(msg)){
         notify('Lỗi quyền/hạn mức; tiến độ đã lưu. Xem nhật ký và mục Hạn mức Plus.');stopRequested=true;break;
       }
       if(attempt<3)await sleep(900*attempt);
       else{notify('Đoạn gặp lỗi 3 lần. Bấm Lọc NAME để thử lại đúng đoạn đó.');stopRequested=true;}
     }
   }
   update();if(!ok)break;
 }
 }finally{
   processing=false;try{await save();}catch(e){log('Lỗi ghi tiến độ: '+e.message);}
   log(stopRequested?'Đã tạm dừng, giữ nguyên tiến độ.':`Đã hoàn thành ${mode==='audit'?'rà soát':'trích xuất'}.`);update();
 }
}
byId('start').addEventListener('click',()=>run('extract'));
byId('audit').addEventListener('click',()=>{if(confirm('Rà lại mọi đoạn bằng AI có thể tiêu tốn đáng kể hạn mức gói Plus. Tiếp tục?'))run('audit');});
byId('pause').addEventListener('click',async()=>{stopRequested=true;byId('pause').disabled=true;try{await api.cancel();}catch{}log('Đã yêu cầu dừng yêu cầu AI hiện tại.');});
async function exportNames(group){if(!entries.length){notify('Chưa có mục NAME nào.');return;}
 const filename=safeFilename(fileName.replace(/\.txt$/i,''))+(group?'_NAME_PHAN_LOAI.txt':'_NAME_QUICK_TRANSLATOR.txt');
 const data=group?exportGrouped(entries):exportClean(entries);
 try{const saved=await api.exportTxt(filename,data);if(saved)notify('Đã xuất '+filename);}catch(e){notify('Lỗi xuất TXT: '+e.message);}
}
for(const id of ['exportGrouped','exportGrouped2'])byId(id).addEventListener('click',()=>exportNames(true));
for(const id of ['exportClean','exportClean2'])byId(id).addEventListener('click',()=>exportNames(false));
const filter=byId('filterCategory');filter.append(new Option('Tất cả nhóm',''));
for(const [key,label] of CATEGORIES)filter.append(new Option(label,key));
byId('search').addEventListener('input',renderTable);filter.addEventListener('change',renderTable);
function cellText(tr,val){const td=tr.insertCell();td.textContent=val;return td;}
function renderTable(){
 const needle=byId('search').value.trim().toLowerCase(),cat=filter.value;
 const filtered=entries.filter(x=>(!cat||x.category===cat)&&(!needle||x.zh.toLowerCase().includes(needle)||x.vi.toLowerCase().includes(needle)));
 const body=byId('tableBody');body.replaceChildren();
 for(const item of filtered.slice(0,600)){
   const row=body.insertRow();cellText(row,item.zh);
   const td2=row.insertCell(),input=document.createElement('input');input.value=item.vi;input.ariaLabel='Tên Hán Việt';input.addEventListener('change',()=>{
     const next=input.value.trim().replace(/[=\r\n]/g,'');if(!next){input.value=item.vi;return;}
     item.vi=next;item.reviewed=true;save().catch(e=>log(e.message));
   });td2.append(input);
   const td3=row.insertCell(),select=document.createElement('select');for(const [key,label] of CATEGORIES)select.append(new Option(label,key));select.value=item.category;
   select.addEventListener('change',()=>{item.category=select.value;save().catch(e=>log(e.message));});td3.append(select);
   cellText(row,number(item.count||1));
   const check=row.insertCell(),review=document.createElement('button');review.className='smallBtn'+(item.reviewed?' checked':'');review.textContent=item.reviewed?'✓ Đã duyệt':'Chưa duyệt';review.addEventListener('click',()=>{item.reviewed=!item.reviewed;review.textContent=item.reviewed?'✓ Đã duyệt':'Chưa duyệt';review.classList.toggle('checked',item.reviewed);save().catch(e=>log(e.message));});check.append(review);
   const actions=row.insertCell(),del=document.createElement('button');del.className='smallBtn danger';del.textContent='Xóa';del.addEventListener('click',()=>{entries=entries.filter(e=>e!==item);save().catch(e=>log(e.message));update();});actions.append(del);
 }
 if(!filtered.length){const row=body.insertRow(),c=row.insertCell();c.colSpan=6;c.textContent='Không có NAME phù hợp.';c.className='empty';}
 byId('shownCount').textContent=`${number(Math.min(600,filtered.length))}/${number(filtered.length)} mục đang hiển thị`+(filtered.length>600?' · tìm kiếm để xem thêm':'');
}
byId('addName').addEventListener('click',()=>{
 const zh=prompt('Nhập tên gốc tiếng Trung:');if(!zh)return;
 const vi=prompt('Nhập tên Việt / Hán Việt:');if(!vi)return;
 const candidate={zh:zh.trim(),vi:vi.trim(),category:filter.value||'PERSON',reviewed:true};
 if(!/\p{Script=Han}/u.test(candidate.zh)||candidate.zh.includes('=')||candidate.vi.includes('=')){notify('NAME phải là cặp Trung–Việt hợp lệ.');return;}
 if(entries.some(e=>e.zh===candidate.zh)){notify('Khóa tiếng Trung đã tồn tại. Hãy sửa trực tiếp trong bảng.');return;}
 entries=[...entries,{...candidate,count:1}];save().catch(e=>log(e.message));update();
});
refreshAuth().then(()=>log('Đã mở giao diện Novel NAME Plus.'));
