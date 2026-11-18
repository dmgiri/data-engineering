import {configureStore,createSlice} from '@reduxjs/toolkit';
let recoveredDrafts={};
try{recoveredDrafts=JSON.parse(sessionStorage.getItem('study-pending-drafts')||'{}')}catch{}
const slice=createSlice({name:'desk',initialState:{data:null,loading:true,error:'',saving:0,view:'desk',questionId:null,materialDay:null,materialSectionId:null,subject:'all',topic:'all',subtopic:'all',sourceKind:'all',search:'',savedOnly:false,focus:false,toast:'',pendingDrafts:recoveredDrafts},reducers:{
  patch(state,{payload}){Object.assign(state,payload)},snapshot(state,{payload}){state.data=payload;state.loading=false;state.error=''},
  cacheDraft(state,{payload}){state.pendingDrafts[payload.id]=payload.text},
  clearDraft(state,{payload}){if(state.pendingDrafts[payload.id]===payload.text)delete state.pendingDrafts[payload.id]}
}});
export const {patch,snapshot,cacheDraft,clearDraft}=slice.actions;
export const store=configureStore({reducer:{desk:slice.reducer}});
let previousDrafts;
store.subscribe(()=>{const drafts=store.getState().desk.pendingDrafts;if(drafts!==previousDrafts){previousDrafts=drafts;try{sessionStorage.setItem('study-pending-drafts',JSON.stringify(drafts))}catch{}}});
export async function api(path='/api/bootstrap',method='GET',body){const response=await fetch(path,{method,headers:{'Content-Type':'application/json','X-Study-Client':'local'},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();if(!response.ok)throw Error(value.error||value.message||'The local database could not save this change.');return value}
let loaded;
export function load(){if(loaded)return loaded;loaded=api().then(data=>{store.dispatch(snapshot(data));Object.entries(store.getState().desk.pendingDrafts).forEach(([id,text])=>persistDraft(id,text))}).catch(error=>{store.dispatch(patch({loading:false,error:error.message}));loaded=null});return loaded}
let queue=Promise.resolve();
export function mutate(path,method,body){
  store.dispatch(patch({saving:store.getState().desk.saving+1}));
  const operation=queue.then(()=>api(path,method,body)).then(data=>{store.dispatch(snapshot(data));return true}).catch(error=>{store.dispatch(patch({error:error.message}));notify(error.message);return false}).finally(()=>store.dispatch(patch({saving:Math.max(0,store.getState().desk.saving-1)})));
  queue=operation;return operation;
}
const draftRequests=new Map();
export function persistDraft(id,text){
  store.dispatch(cacheDraft({id,text}));
  const key=JSON.stringify([id,text]);if(draftRequests.has(key))return draftRequests.get(key);
  const request=mutate('/api/drafts/'+id,'PUT',{text}).then(saved=>{if(saved)store.dispatch(clearDraft({id,text}));return saved}).finally(()=>draftRequests.delete(key));draftRequests.set(key,request);return request;
}
let toastTimer;
export function notify(message){store.dispatch(patch({toast:message}));clearTimeout(toastTimer);toastTimer=setTimeout(()=>store.dispatch(patch({toast:''})),4000)}
export const uid=()=>crypto.randomUUID();
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function download(value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`engineer-prep-${today()}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
