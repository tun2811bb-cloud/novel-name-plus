'use strict';
const {app, BrowserWindow, ipcMain, dialog, shell, safeStorage} = require('electron');
const {join} = require('node:path');
const {mkdir, readFile, writeFile, rename} = require('node:fs/promises');
const {initializeUpdater}=require('./updater.cjs');
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
  return `Bạn là biên tập viên NAME cho Quick Translator. Chỉ lọc NAME thật sự đặc thù của truyện, không chạy theo số lượng.\n`+
  `Đối tượng giữ: tên nhân vật, biệt danh có tính định danh, địa danh, tổ chức, tôn hiệu cố định, công pháp/chiêu thức riêng, vật phẩm độc nhất.\n`+
  `Loại khỏi NAME: chức vụ theo thứ tự/số hiệu (第八队长, 九号队长), chức danh đứng một mình, xưng hô tự do, từ phổ thông, màu sắc/phẩm cấp, vật dụng chức năng, tên loại bản vẽ/vật phẩm.\n`+
  `Đối với cấp bậc, loài quái, vật liệu, loại vật phẩm phổ biến: chỉ đưa vào nếu là thuật ngữ riêng cần thống nhất; khi đó gán type=term. Không ép mọi thuật ngữ vào NAME.\n`+
  `Quy chuẩn convert bắt buộc: TÊN + hậu tố chức danh (Bạch trưởng lão, Lâm đại công tử, Lạc tiểu thư, U Minh công chúa); hậu tố thường, không đảo trước tên. Riêng địa danh giữ thứ tự tiếng Việt tự nhiên.\n`+
  `Danh hiệu/tôn hiệu lịch sử có tên cố định như Tần Thủy Hoàng là ngoại lệ, giữ nguyên.\n`+
  `Tên quốc tế: ưu tiên tên gốc Latin chuẩn khi được nhận diện chắc chắn (Jack, Jason, Hannibal...). Nếu không chắc, gán origin=foreign hoặc origin=unknown, không đoán tên quốc tế và KHÔNG tạo phiên âm Hán Việt rồi cho xuất sạch.\n`+
  `Đặc biệt tên theo lối dịch phiên âm tiếng Trung (ví dụ 顿克斯, 费罗恩, 蛮斯格, 休斯格, 罗斯杰, 科娃) phải được đánh dấu khả nghi quốc tế ngay cả khi chưa tìm được tên Latin. Không gán origin=domestic chỉ để né bước kiểm tra.\n`+
  `Thêm trường evidence là ngữ cảnh/chi tiết ngắn trong đoạn trích chứng minh nguồn gốc tên. Nếu không rõ hãy để rỗng. Tuyệt đối không bịa evidence.\n`+
  `Viết hoa phần tên riêng đúng chính tả tiếng Việt; không Viết Hoa Từng Chữ của từ phổ thông. Không có dấu = hoặc xuống dòng trong giá trị.\n`+
  `Phân loại category: PERSON, ALIAS, TITLE, DAO_NAME, LOCATION, FACTION, SKILL, SPELL, REALM, CREATURE, PLANT, ITEM, BOOK, OTHER.\n`+
  `Chỉ trả JSON: {"names":[{"zh":"汉字原样","vi":"Tên Việt chuẩn","category":"PERSON","type":"name","origin":"domestic","evidence":""}]}. type thuộc name|term|generic; origin thuộc domestic|foreign|unknown. Không cần trả type=generic. Chỉ giữ zh xuất hiện nguyên văn.\n`+
  `Ưu tiên tránh dương tính giả, đặc biệt không bịa cách viết tiếng Anh của tên phiên âm.\n`+
  (mode==='audit'?'Lượt kiểm tra thứ hai: tìm tên riêng bỏ sót, không trả lại khóa đã có.\n':'')+
  (known.length?'Từ điển hiện có, dùng thống nhất: \n'+known.map(x=>x.zh+'='+x.vi).join('\n')+'\n':'');
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
let chatgptLoading;
async function getChatGPT() {
  if (chatgpt) return chatgpt;
  if (!chatgptLoading) chatgptLoading = import('@siwc/local').then(({createChatGPT}) => {
    chatgpt = createChatGPT({
      appName:'Novel NAME Plus', appId:'novel-name-plus', redirectPort:0,
      storageDir:join(app.getPath('userData'),'chatgpt'), credentialEncryption:encryptionProvider(),
      openBrowser:async url=>{const u=new URL(url);if(u.origin!=='https://auth.openai.com')throw new Error('Địa chỉ OAuth không hợp lệ');await shell.openExternal(u.href);}
    });
    return chatgpt;
  }).catch(error=>{chatgptLoading=null;throw new Error('Không nạp được SDK ChatGPT. Chạy setup-windows.ps1: '+safeError(error));});
  return chatgptLoading;
}
app.whenReady().then(async()=>{
  ipcMain.handle('auth:state',async e=>{verifySender(e);try{return await (await getChatGPT()).getSession();}catch(error){return {status:'disconnected',sharing:false,error:{message:safeError(error)}};}});
  ipcMain.handle('auth:signin',async e=>{verifySender(e);return await (await getChatGPT()).signIn();});
  ipcMain.handle('auth:signout',async e=>{verifySender(e);if(chatgpt)await chatgpt.disconnect();return {ok:true};});
  ipcMain.handle('auth:models',async e=>{verifySender(e);const client=await getChatGPT();const session=await client.getSession();if(!session.sharing)return [];return await client.listModels();});
  ipcMain.handle('ai:extract',async (e,input)=>{
    verifySender(e);
    const client=await getChatGPT();
    const state=await client.getSession();if(!state.sharing)throw new Error('Cần đăng nhập và cấp quyền dùng gói ChatGPT trước');
    if(pendingRequest)throw new Error('Đang xử lý một đoạn khác');
    const text=String(input?.text||'');const model=String(input?.model||'');
    const mode=input?.mode==='audit'?'audit':'extract';
    if(text.length<1||text.length>10000||!model||model.length>100)throw new Error('Đoạn văn hoặc mô hình không hợp lệ');
    const known=Array.isArray(input?.known)?input.known.slice(0,50).filter(x=>x&&typeof x.zh==='string'&&typeof x.vi==='string'):[];
    const controller=new AbortController();pendingRequest=controller;
    try {const response=await client.streamResponse({model,input:[{role:'user',content:'ĐOẠN TRUYỆN CẦN LỌC NAME:\n'+text}],instructions:instructions(mode,known),signal:controller.signal});return String(response.text||'');}
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
  let updater;
  try{updater=require('electron-updater').autoUpdater;}catch(e){console.error('Updater unavailable:',safeError(e));}
  const updates=initializeUpdater({app,win,ipcMain,shell,verifySender,hasActiveAI:()=>Boolean(pendingRequest),updater});
  if(updates.supported){setTimeout(()=>updates.check().catch(err=>console.error(safeError(err))),4000);}
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)makeWindow();});
