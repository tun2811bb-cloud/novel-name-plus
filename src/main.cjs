'use strict';
const {app, BrowserWindow, ipcMain, dialog, shell, safeStorage} = require('electron');
const {join} = require('node:path');
const {mkdir, readFile, writeFile, rename} = require('node:fs/promises');
let win, chatgpt, pendingRequest;

function verifySender(event) {
  if (!win || event.sender !== win.webContents) throw new Error('Lời gọi không hợp lệ');
}
function safeError(error) {
  const m = String(error?.message||error||'Lỗi không xác định');
  return m.slice(0,700).replace(/(Bearer\s+|sk-[A-Za-z0-9_-]{10,})/gi,'[ẩn thông tin]');
}
function encryptionProvider() {
  return {
    id:'novel-name-plus-electron-safe-storage-v1',
    isAvailable:()=> app.isReady()&&safeStorage.isEncryptionAvailable() &&
      (process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(safeStorage.getSelectedStorageBackend())),
    encrypt(plaintext) {if(!this.isAvailable())throw new Error('Không có kho khóa bảo mật hệ điều hành');return safeStorage.encryptString(plaintext);},
    decrypt(ciphertext) {if(!this.isAvailable())throw new Error('Không có kho khóa bảo mật hệ điều hành');return safeStorage.decryptString(Buffer.from(ciphertext));}
  };
}
function instructions(mode, known) {
  return `Bạn là biên tập viên chuyên lọc NAME từ tiểu thuyết chữ Hán, dùng cho Quick Translator.\n`+
  `Trích xuất mọi danh từ RIÊNG thật sự xuất hiện nguyên văn trong đoạn trích, không bịa tên, không tự ghép cụm từ ngoài văn bản.\n`+
  `Bao gồm: nhân vật, bí danh/tên gọi, tước hiệu, đạo hiệu/thần hiệu, địa danh/thế giới, thế lực/môn phái, công pháp, pháp thuật, cảnh giới, loài dị thú/quái vật có tên, linh dược, vật phẩm, kinh thư.\n`+
  `Không đưa danh từ chung như người, con quạ, hệ thống, kinh nghiệm, cấp độ, nếu chúng không phải tên riêng trong truyện.\n`+
  `Bản Việt sử dụng âm Hán Việt tự nhiên, nhất quán; không tự suy đoán chữ khác; tên nước ngoài/nhãn hiệu có thể giữ tên chuẩn nếu rõ.\n`+
  `Mã category chỉ được chọn trong: PERSON, ALIAS, TITLE, DAO_NAME, LOCATION, FACTION, SKILL, SPELL, REALM, CREATURE, PLANT, ITEM, BOOK, OTHER.\n`+
  `Viết CHÍNH XÁC một đối tượng JSON không markdown: {"names":[{"zh":"汉字原样","vi":"Tên Việt", "category":"PERSON"}]}. Trả [] nếu không có.\n`+
  `Ưu tiên độ chính xác hơn số lượng, giữ tên gốc hoàn chỉnh, không có khoảng trắng quanh dấu bằng.\n`+
  (mode==='audit'?'Đây là lượt kiểm tra thứ hai: tìm NAME đã bị bỏ sót trong đoạn này, không trả lại những khóa đã có.\n':'')+
  (known.length?'Những cặp NAME đã biết trong bộ truyện này (ưu tiên dịch nhất quán, không nhắc lại khi rà lần hai):\n'+known.map(x=>x.zh+'='+x.vi).join('\n')+'\n':'');
}
async function readJson(file, fallback) {try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback; throw e;}}
async function atomicJson(file,data) {await mkdir(join(app.getPath('userData'),'projects'),{recursive:true});const tmp=file+'.writing';await writeFile(tmp,JSON.stringify(data),'utf8');await rename(tmp,file);}
async function makeWindow() {
  win = new BrowserWindow({width:1380,height:860,minWidth:1020,minHeight:660,
    title:'Novel NAME Plus', backgroundColor:'#0d1423',
    webPreferences:{preload:join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  await win.loadFile(join(__dirname,'index.html'));
}
app.whenReady().then(async()=>{
  try {
    const {createChatGPT}=await import('@siwc/local');
    chatgpt = createChatGPT({
      appName:'Novel NAME Plus',appId:'novel-name-plus',redirectPort:0,
      storageDir:join(app.getPath('userData'),'chatgpt'),credentialEncryption:encryptionProvider(),
      openBrowser:async url=>{const u=new URL(url);if(u.origin!=='https://auth.openai.com')throw new Error('Địa chỉ OAuth không hợp lệ');await shell.openExternal(u.href);}
    });
  } catch(e) { console.error('Không thể nạp SDK chính thức:',safeError(e)); }
  ipcMain.handle('auth:state',async e=>{verifySender(e);return chatgpt?await chatgpt.getSession():{status:'disconnected',sharing:false,error:{message:'Chưa cài OpenAI SDK. Chạy scripts/setup-windows.ps1 trước.'}};});
  ipcMain.handle('auth:signin',async e=>{verifySender(e);if(!chatgpt)throw new Error('Chưa cài SDK');return await chatgpt.signIn();});
  ipcMain.handle('auth:signout',async e=>{verifySender(e);if(chatgpt)await chatgpt.disconnect();return {ok:true};});
  ipcMain.handle('auth:models',async e=>{verifySender(e);if(!chatgpt)throw new Error('Chưa cài SDK');const session=await chatgpt.getSession();if(!session.sharing)return [];return await chatgpt.listModels();});
  ipcMain.handle('ai:extract',async (e,input)=>{
    verifySender(e);
    if(!chatgpt)throw new Error('Chưa cài SDK');
    const state=await chatgpt.getSession();if(!state.sharing)throw new Error('Cần đăng nhập và cấp quyền dùng gói ChatGPT trước');
    if(pendingRequest)throw new Error('Đang xử lý một đoạn khác');
    const text=String(input?.text||'');const model=String(input?.model||'');
    const mode=input?.mode==='audit'?'audit':'extract';
    if(text.length<1||text.length>10000||!model||model.length>100)throw new Error('Đoạn văn hoặc mô hình không hợp lệ');
    const known=Array.isArray(input?.known)?input.known.slice(0,50).filter(x=>x&&typeof x.zh==='string'&&typeof x.vi==='string'):[];
    const controller=new AbortController();pendingRequest=controller;
    try {const response=await chatgpt.streamResponse({model,input:[{role:'user',content:'ĐOẠN TRUYỆN CẦN LỌC NAME:\n'+text}],instructions:instructions(mode,known),signal:controller.signal});return String(response.text||'');}
    catch(err){throw new Error(safeError(err));}
    finally {pendingRequest=null;}
  });
  ipcMain.handle('ai:cancel',e=>{verifySender(e);pendingRequest?.abort();return true;});
  ipcMain.handle('project:load',async (e,key)=>{verifySender(e);if(!/^[a-z0-9_-]{8,100}$/.test(key))throw new Error('Mã dự án không hợp lệ');return await readJson(join(app.getPath('userData'),'projects',key+'.json'),null);});
  ipcMain.handle('project:save',async (e,key,project)=>{verifySender(e);if(!/^[a-z0-9_-]{8,100}$/.test(key))throw new Error('Mã dự án không hợp lệ');const json=JSON.stringify(project);if(json.length>8_000_000)throw new Error('Dự án quá lớn');await atomicJson(join(app.getPath('userData'),'projects',key+'.json'),project);return true;});
  ipcMain.handle('export:txt',async (e,name,data)=>{verifySender(e);if(typeof data!=='string'||data.length>12_000_000)throw new Error('Văn bản xuất không hợp lệ');
    const answer=await dialog.showSaveDialog(win,{title:'Xuất NAME TXT UTF-8',defaultPath:String(name||'NAME.txt').slice(0,150),filters:[{name:'Văn bản UTF-8',extensions:['txt']}]});
    if(answer.canceled||!answer.filePath)return false;await writeFile(answer.filePath,data,'utf8');return true;
  });
  ipcMain.handle('external:usage',async e=>{verifySender(e);await shell.openExternal('https://chatgpt.com/settings/usage');return true;});
  await makeWindow();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)makeWindow();});
