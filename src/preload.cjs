'use strict';
const {contextBridge, ipcRenderer}=require('electron');
// Only a narrow, validated API is exposed; OAuth tokens remain in the main process.
contextBridge.exposeInMainWorld('namePlus',Object.freeze({
  session:()=>ipcRenderer.invoke('auth:state'),
  signIn:()=>ipcRenderer.invoke('auth:signin'),
  signOut:()=>ipcRenderer.invoke('auth:signout'),
  models:()=>ipcRenderer.invoke('auth:models'),
  extract:(text,model,mode,known)=>ipcRenderer.invoke('ai:extract',{text,model,mode,known}),
  cancel:()=>ipcRenderer.invoke('ai:cancel'),
  loadProject:key=>ipcRenderer.invoke('project:load',key),
  saveProject:(key,project)=>ipcRenderer.invoke('project:save',key,project),
  exportTxt:(name,data)=>ipcRenderer.invoke('export:txt',name,data),
  usage:()=>ipcRenderer.invoke('external:usage'),
  updateState:()=>ipcRenderer.invoke('update:state'),
  checkUpdate:()=>ipcRenderer.invoke('update:check'),
  downloadUpdate:()=>ipcRenderer.invoke('update:download'),
  installUpdate:()=>ipcRenderer.invoke('update:install'),
  updateReleases:()=>ipcRenderer.invoke('update:releases'),
  onUpdate:callback=>{const handler=(_event,data)=>callback(data);ipcRenderer.on('update:changed',handler);return()=>ipcRenderer.removeListener('update:changed',handler);}
}));
