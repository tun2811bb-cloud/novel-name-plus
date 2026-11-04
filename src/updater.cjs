'use strict';
const {join} = require('node:path');
const {mkdir, readdir, copyFile} = require('node:fs/promises');
const RELEASES_URL = 'https://github.com/tun2811bb-cloud/novel-name-plus/releases';

function updaterAvailable({platform, isPackaged, portableExecutable}) {
  return platform === 'win32' && isPackaged === true && !portableExecutable;
}

/** Backup lives outside projects; same userData path is retained across upgrades. */
async function backupProjects(userData) {
  const folder = join(userData, 'projects');
  let files;
  try { files = (await readdir(folder, {withFileTypes:true})).filter(x=>x.isFile() && /^[a-z0-9_-]{8,100}\.json$/u.test(x.name)); }
  catch (error) { if (error.code==='ENOENT') return {count:0}; throw error; }
  if (!files.length) return {count:0};
  const dest = join(userData, 'update-backups', new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(dest,{recursive:true});
  for(const file of files) await copyFile(join(folder,file.name),join(dest,file.name));
  return {count:files.length,location:dest};
}

/** All updater operations run in the trusted Electron main process. */
function initializeUpdater({app,win,ipcMain,shell,verifySender,hasActiveAI,updater,platform=process.platform,env=process.env}) {
  const supported = Boolean(updater) && updaterAvailable({platform,isPackaged:app.isPackaged,portableExecutable:env.PORTABLE_EXECUTABLE_FILE});
  let snapshot = {supported, version:app.getVersion(),status:supported?'idle':'unsupported',message:supported?'Sẵn sàng kiểm tra phiên bản mới.':'Cập nhật trực tiếp chỉ hỗ trợ bản Windows đã cài đặt. Bản Portable dùng GitHub Releases.',progress:0,availableVersion:null};
  const publish = patch => {snapshot = {...snapshot,...patch};if(win&&!win.isDestroyed())win.webContents.send('update:changed',snapshot);};
  const checkSupported = () => {if(!supported)throw new Error('Hãy cài bản Windows Setup từ GitHub Releases để tự cập nhật.');};
  const check = async () => {
    checkSupported();
    if(['checking','downloading','downloaded'].includes(snapshot.status))return snapshot;
    publish({status:'checking',message:'Đang kiểm tra bản mới…'});
    try {await updater.checkForUpdates();}catch(error){publish({status:'error',message:'Không kiểm tra được bản mới: '+String(error.message||error).slice(0,210)});}
    return snapshot;
  };
  ipcMain.handle('update:state',event=>{verifySender(event);return snapshot;});
  ipcMain.handle('update:check',async event=>{verifySender(event);return await check();});
  ipcMain.handle('update:download',async event=>{
    verifySender(event);checkSupported();
    if(snapshot.status!=='available') throw new Error('Chưa có bản cập nhật để tải.');
    publish({status:'downloading',progress:0,message:'Đang tải bản cập nhật…'});
    try { await updater.downloadUpdate(); } catch(error) {publish({status:'error',message:'Tải cập nhật lỗi: '+String(error.message||error).slice(0,200)});throw error;}
    return snapshot;
  });
  ipcMain.handle('update:install',async event=>{
    verifySender(event);checkSupported();
    if(snapshot.status!=='downloaded')throw new Error('Chưa tải xong bản cập nhật.');
    if(hasActiveAI())throw new Error('Hãy dừng và lưu tiến độ lọc NAME trước khi cập nhật.');
    const backup = await backupProjects(app.getPath('userData'));
    publish({status:'installing',message:`Đã sao lưu ${backup.count} dự án. Ứng dụng sẽ khởi động lại.`});
    updater.quitAndInstall(false,true);
    return {ok:true};
  });
  ipcMain.handle('update:releases',async event=>{verifySender(event);await shell.openExternal(RELEASES_URL);return {ok:true};});
  if(supported){
    updater.autoDownload=false;
    updater.autoInstallOnAppQuit=false;
    updater.on('checking-for-update',()=>publish({status:'checking',message:'Đang kiểm tra bản cập nhật…'}));
    updater.on('update-available',info=>publish({status:'available',availableVersion:info.version,message:`Có phiên bản ${info.version}. Bấm Tải cập nhật để tiếp tục.`}));
    updater.on('update-not-available',()=>publish({status:'up-to-date',message:'Bạn đang dùng phiên bản mới nhất.'}));
    updater.on('download-progress',progress=>publish({status:'downloading',progress:Math.max(0,Math.min(100,Math.round(progress.percent||0))),message:`Đang tải cập nhật: ${Math.round(progress.percent||0)}%.`}));
    updater.on('update-downloaded',info=>publish({status:'downloaded',progress:100,availableVersion:info.version,message:'Đã tải xong. Bấm Cài và khởi động lại để áp dụng.'}));
    updater.on('error',error=>publish({status:'error',message:'Lỗi kiểm tra/cập nhật: '+String(error.message||error).slice(0,200)}));
  }
  return {check,getState:()=>snapshot,supported};
}
module.exports = {initializeUpdater,updaterAvailable,backupProjects,RELEASES_URL};
