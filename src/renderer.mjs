import {internationalEvidence,isLatinName,isLikelyHanVietSpelling} from './international.mjs';
import {CATEGORIES,buildChunks,splitChapters,mergeEntries,parseAIResult,exportClean,exportGrouped,exportableEntries,assessEntry,qualitySummary,QUALITY_STATUSES,parseNameTxt,safeFilename} from './core.mjs';
const byId = id=>document.getElementById(id);
const api=window.namePlus;
let raw='', fileName='', chunks=[], chapters=[], key='', entries=[], done=new Set(), audited=new Set();
let processing=false, stopRequested=false, phase='extract', logged=[], session={status:'disconnected',sharing:false};
const PAGE_SIZE=80;let resultsPage=0;let searchTimer;let saveQueue=Promise.resolve();
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
 entries=[];done=new Set();audited=new Set();phase='extract';resultsPage=0;
 byId('filename').textContent=name;
 byId('fileStats').textContent=`${number(raw.length)} ký tự · ${number(chapters.filter(c=>/^第/.test(c.heading)).length)} chương`;
 byId('fileInfo').classList.remove('hidden');
 try {const saved=await api.loadProject(key);if(saved&&saved.version===1&&Array.isArray(saved.entries)){
   entries=saved.entries.map(x=>assessEntry(x));done=new Set(saved.done||[]);audited=new Set(saved.audited||[]);log(`Đã khôi phục ${number(done.size)} đoạn đã quét và ${number(entries.length)} NAME.`);
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
async function importNameFile(file){
 if(!file||processing)return;
 const text=await file.text();const imported=parseNameTxt(text);
 if(!imported.length){notify('Không thấy cặp NAME dạng 中文=Tiếng Việt.');return;}
 raw='';chunks=[];chapters=[];fileName=file.name;key='q_'+hash(text);
 const saved=await api.loadProject(key).catch(()=>null);
 entries=(saved?.version===1&&Array.isArray(saved.entries)?saved.entries:imported).map(x=>assessEntry(x));
 done=new Set();audited=new Set();resultsPage=0;
 byId('filename').textContent=file.name;
 byId('fileStats').textContent=`${number(entries.length)} NAME đã nhập · dùng để rà soát và xuất lại`;
 byId('fileInfo').classList.remove('hidden');
 await save();log(`Đã nhập ${number(entries.length)} NAME từ ${file.name}.`);
 update();switchPage('results');
}
byId('nameInput').addEventListener('change',e=>importNameFile(e.target.files?.[0]).catch(err=>notify(err.message)));
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

async function save(){
 if(!key)return;
 // Serialise writes so a fast edit never races an earlier save.
 const project={version:1,fileName,entries:entries.map(x=>({...x})),done:[...done],audited:[...audited],savedAt:new Date().toISOString()};
 const k=key;saveQueue=saveQueue.catch(()=>{}).then(()=>api.saveProject(k,project));return saveQueue;
}
function visibleExports(){return exportableEntries(entries,{includeTerms:byId('includeTerms').checked});}
function update(){
 const total=chunks.length, finished=phase==='audit'?audited.size:done.size,pct=total?Math.round(100*finished/total):0;
 byId('chapters').textContent=number(chapters.filter(c=>/^第/.test(c.heading)).length);
 byId('parts').textContent=number(total);byId('names').textContent=number(entries.length);
 byId('progressPct').textContent=pct+'%';byId('progressFill').style.width=pct+'%';
 byId('progressText').textContent=total?`${phase==='audit'?'Lượt rà soát':'Lượt trích xuất'} · ${number(finished)}/${number(total)} đoạn`:'Hãy chọn truyện để bắt đầu.';
 byId('start').disabled=!raw||!session.sharing||!byId('model').value||processing;
 byId('pause').disabled=!processing;byId('audit').disabled=!raw||!session.sharing||processing||done.size!==total||total===0;
 const totalGood=visibleExports().length;byId('exportGrouped').disabled=totalGood===0;byId('exportClean').disabled=totalGood===0;
 const q=qualitySummary(entries);
 byId('resultCount').textContent=`${number(entries.length)} mục`;
 byId('qcInfo').textContent=`${number(q.keep)} NAME · ${number(q.term)} thuật ngữ · ${number(q.review)} cần rà · ${number(q.omit)} loại · ${number(q.invalid)} bản Việt còn chữ Hán/thiếu`;
 byId('exportHint').textContent=`Xuất an toàn: ${number(totalGood)}/${number(entries.length)} mục. Những mục chưa duyệt/loại sẽ không xuất.`;
 setPhase(processing?'Đang quét':(!raw?'Chờ tệp':(done.size===total?'Đã quét lượt một':'Sẵn sàng')));
 // The result table is rendered only on navigation/filter/edit, not on every AI chunk.
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
 const options={includeTerms:byId('includeTerms').checked};const data=group?exportGrouped(entries,options):exportClean(entries,options);
 if(!data.trim()){notify('Không có NAME hợp lệ để xuất; hãy kiểm tra mục Cần rà soát.');return;}
 try{const saved=await api.exportTxt(filename,data);if(saved)notify('Đã xuất '+filename);}catch(e){notify('Lỗi xuất TXT: '+e.message);}
}
for(const id of ['exportGrouped','exportGrouped2'])byId(id).addEventListener('click',()=>exportNames(true));
for(const id of ['exportClean','exportClean2'])byId(id).addEventListener('click',()=>exportNames(false));
const filter=byId('filterCategory');filter.append(new Option('Tất cả nhóm',''));
for(const [key,label] of CATEGORIES)filter.append(new Option(label,key));
const statusFilter=byId('filterStatus');statusFilter.append(new Option('Tất cả trạng thái',''));
for(const [key,label] of QUALITY_STATUSES)statusFilter.append(new Option(label,key));
byId('search').addEventListener('input',()=>{resultsPage=0;clearTimeout(searchTimer);searchTimer=setTimeout(renderTable,140);});
filter.addEventListener('change',()=>{resultsPage=0;renderTable();});
statusFilter.addEventListener('change',()=>{resultsPage=0;renderTable();});
byId('includeTerms').addEventListener('change',()=>{update();renderTable();});
byId('prevPage').addEventListener('click',()=>{resultsPage=Math.max(0,resultsPage-1);renderTable();});
byId('nextPage').addEventListener('click',()=>{resultsPage++;renderTable();});
function cellText(tr,val){const td=tr.insertCell();td.textContent=val;return td;}
function renderTable(){
 if(!byId('results')||byId('results').classList.contains('hidden'))return;
 const needle=byId('search').value.trim().toLowerCase(),cat=filter.value,status=statusFilter.value;
 const filtered=entries.filter(x=>(!cat||x.category===cat)&&(!status||x.status===status)&&(!needle||x.zh.toLowerCase().includes(needle)||x.vi.toLowerCase().includes(needle)));
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));resultsPage=Math.min(resultsPage,pages-1);
 const body=byId('tableBody');const frag=document.createDocumentFragment();
 for(const item of filtered.slice(resultsPage*PAGE_SIZE,(resultsPage+1)*PAGE_SIZE)){
   const row=document.createElement('tr');const source=document.createElement('td');source.textContent=item.zh;row.append(source);
   const td2=document.createElement('td'),input=document.createElement('input');input.value=item.vi;input.ariaLabel='Tên Việt';
   input.addEventListener('change',()=>{
     const next=input.value.trim().replace(/[=\r\n]/g,'');if(!next){input.value=item.vi;return;}
     item.vi=next;item.reviewed=true;item.foreignVerified=false;Object.assign(item,assessEntry(item));
     save().catch(e=>log(e.message));update();renderTable();
   });td2.append(input);row.append(td2);
   const td3=document.createElement('td'),select=document.createElement('select');for(const [key,label] of CATEGORIES)select.append(new Option(label,key));select.value=item.category;
   select.addEventListener('change',()=>{item.category=select.value;Object.assign(item,assessEntry(item));save().catch(e=>log(e.message));update();renderTable();});td3.append(select);row.append(td3);
   const tdOrigin=document.createElement('td'), originSelect=document.createElement('select'); originSelect.className='originSelect';
   for(const [code,label] of [['unknown','Chưa rõ'],['domestic','Tên Trung'],['foreign','Quốc tế']])originSelect.append(new Option(label,code));
   originSelect.value=item.origin||'unknown';
   originSelect.addEventListener('change',()=>{item.origin=originSelect.value;item.originConfirmed=(item.origin!=='unknown');item.foreignVerified=false;Object.assign(item,assessEntry(item));save().catch(e=>log(e.message));update();renderTable();});
   tdOrigin.append(originSelect);
   const intl=internationalEvidence(item);
   if(intl.isForeign){
     if(intl.verified){const ok=document.createElement('small');ok.className='foreignConfirmed';ok.textContent='✓ Tên Latin đã xác minh';tdOrigin.append(ok);}
     else{const verify=document.createElement('button');verify.className='smallBtn foreignConfirm';verify.textContent='Xác minh tên Latin';verify.addEventListener('click',()=>{
       if(!isLatinName(item.vi)||isLikelyHanVietSpelling(item.vi)){notify('Chưa hợp lệ: hãy sửa thành tên quốc tế viết bằng chữ Latin, không phải Hán Việt.');return;}
       if(!confirm('Bạn đã đối chiếu tên gốc của '+item.zh+' và xác nhận '+item.vi+' là cách viết Latin đúng?'))return;
       item.origin='foreign';item.originConfirmed=true;item.foreignVerified=true;item.reviewed=true;Object.assign(item,assessEntry(item));save().catch(e=>log(e.message));update();renderTable();
     });tdOrigin.append(verify);}
   }
   row.append(tdOrigin);
   const td4=document.createElement('td'),statusSelect=document.createElement('select');statusSelect.className='statusSelect';
   for(const [key,label] of QUALITY_STATUSES)statusSelect.append(new Option(label,key));statusSelect.value=item.status;
   statusSelect.addEventListener('change',()=>{item.status=statusSelect.value;item.manualStatus=true;Object.assign(item,assessEntry(item));save().catch(e=>log(e.message));update();renderTable();});
   td4.append(statusSelect);
   if(item.issues?.length){const hint=document.createElement('small');hint.className='qcNote';hint.textContent=item.issues.join(' · ');td4.append(hint);}
   row.append(td4);cellText(row,number(item.count||1));
   const check=document.createElement('td'),review=document.createElement('button');review.className='smallBtn'+(item.reviewed?' checked':'');review.textContent=item.reviewed?'✓ Đã duyệt':'Chưa duyệt';review.addEventListener('click',()=>{item.reviewed=!item.reviewed;review.textContent=item.reviewed?'✓ Đã duyệt':'Chưa duyệt';review.classList.toggle('checked',item.reviewed);save().catch(e=>log(e.message));});check.append(review);row.append(check);
   const actions=document.createElement('td'),del=document.createElement('button');del.className='smallBtn danger';del.textContent='Xóa';del.addEventListener('click',()=>{entries=entries.filter(e=>e!==item);save().catch(e=>log(e.message));update();renderTable();});actions.append(del);row.append(actions);
   frag.append(row);
 }
 body.replaceChildren(frag);
 if(!filtered.length){const row=body.insertRow(),c=row.insertCell();c.colSpan=8;c.textContent='Không có NAME phù hợp.';c.className='empty';}
 byId('shownCount').textContent=`${number(filtered.length)} mục · Trang ${number(resultsPage+1)}/${number(pages)}`;
 byId('prevPage').disabled=resultsPage===0;byId('nextPage').disabled=resultsPage+1>=pages;
}
byId('addName').addEventListener('click',()=>{
 const zh=prompt('Nhập tên gốc tiếng Trung:');if(!zh)return;
 const vi=prompt('Nhập tên Việt / Hán Việt:');if(!vi)return;
 const candidate={zh:zh.trim(),vi:vi.trim(),category:filter.value||'PERSON',reviewed:true};
 if(!/\p{Script=Han}/u.test(candidate.zh)||candidate.zh.includes('=')||candidate.vi.includes('=')){notify('NAME phải là cặp Trung–Việt hợp lệ.');return;}
 if(entries.some(e=>e.zh===candidate.zh)){notify('Khóa tiếng Trung đã tồn tại. Hãy sửa trực tiếp trong bảng.');return;}
 entries=[...entries,assessEntry({...candidate,count:1})];save().catch(e=>log(e.message));update();renderTable();
});
// Paint the workspace first; only then initialise the OAuth SDK.
log('Đã mở giao diện Novel NAME Plus.');
setTimeout(()=>refreshAuth(),350);

// Updates are optional: the installed Windows edition supports in-app updates,
// whereas Portable keeps an explicit GitHub Releases link.
function renderUpdate(state){
 if(!state)return;
 const banner=byId('updateBanner');
 const stateCode=state.status||'unsupported';
 const visible=['available','downloading','downloaded','error'].includes(stateCode);
 banner.classList.toggle('hidden',!visible);
 byId('updateTitle').textContent=stateCode==='downloaded'?'Đã tải bản cập nhật':stateCode==='available'?'Có bản Novel NAME Plus mới':stateCode==='downloading'?'Đang tải cập nhật':'Không thể kiểm tra/cập nhật';
 byId('updateMessage').textContent=state.message||'';
 byId('updateDownload').classList.toggle('hidden',stateCode!=='available');
 byId('updateInstall').classList.toggle('hidden',stateCode!=='downloaded');
 byId('updateProgress').classList.toggle('hidden',stateCode!=='downloading');
 byId('updateProgressBar').style.width=Math.min(100,Math.max(0,state.progress||0))+'%';
 byId('updateCheck').disabled=stateCode==='checking'||stateCode==='downloading'||stateCode==='installing';
 byId('updateCheck').textContent=stateCode==='checking'?'Đang kiểm tra…':stateCode==='unsupported'?'Tải bản mới ↗':'↻ Kiểm tra cập nhật';
}
byId('updateCheck').addEventListener('click',async()=>{
 try{const local=await api.updateState();if(!local.supported){await api.updateReleases();return;}const state=await api.checkUpdate();renderUpdate(state);
 if(state.status==='up-to-date')notify(state.message);}
 catch(e){notify(e.message);} 
});
byId('updateDownload').addEventListener('click',async()=>{try{renderUpdate(await api.downloadUpdate());}catch(e){notify(e.message);}});
byId('updateInstall').addEventListener('click',async()=>{
 if(processing){notify('Hãy tạm dừng và lưu tiến độ quét trước khi cập nhật.');return;}
 if(!confirm('Cài đặt bản mới và khởi động lại? Dữ liệu dự án sẽ được sao lưu trước khi cài.'))return;
 try{await save();await api.installUpdate();}catch(e){notify('Không thể cập nhật: '+e.message);}
});
byId('updateReleases').addEventListener('click',()=>api.updateReleases());
api.onUpdate(renderUpdate);
api.updateState().then(renderUpdate).catch(e=>log('Trạng thái cập nhật: '+e.message));
