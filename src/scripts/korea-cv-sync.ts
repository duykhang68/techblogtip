import {configured,connectGoogle,connected,disconnectGoogle,driveRequest,createCVId} from '../lib/korea-cv-client.mjs';

const element = (id:string) => document.getElementById(id) as HTMLElement;
const status = (value:string, tone:'neutral'|'info'|'success'|'error'='info') => {
  const node=element('service-status');
  node.dataset.state=tone;
  const dot=node.querySelector('.kcv-status-dot');
  node.replaceChildren(...(dot?[dot]:[]),document.createTextNode(value));
};
const clientId=import.meta.env.PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID || '';
const api=import.meta.env.PUBLIC_KOREA_CV_API_URL || '';
let currentId='';
let revision=-1;
let createdAt='';
// Action controls and saved CV toolbar live in Astro markup, so scoped styles
// apply consistently (previously JS-injected buttons appeared as browser defaults).
const btn=(id:string)=>element(id) as HTMLButtonElement;
const select=()=>element('kcv-select') as HTMLSelectElement;
function buttons(auth:boolean) {
  btn('kcv-connect').hidden=auth;btn('kcv-signout').hidden=!auth;
  for(const name of ['kcv-save','kcv-new','kcv-refresh'])btn(name).disabled=!auth;
  for(const id of ['kcv-open','kcv-copy','kcv-remove'])btn(id).disabled=!auth||!select().value;
}
function capture() {
  const cv:any={schemaVersion:1,id:currentId||createCVId(),label:'',targetCompany:'',targetRole:'',locale:'ko',revision:revision < 0 ? 0 : revision + 1,createdAt:createdAt || new Date().toISOString(),updatedAt:new Date().toISOString(),content:{personal:{},essays:{},optionalSensitive:{},declarationOptional:null}};
  document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('#input-panel [name]').forEach(field=>{
    const [section = '',key]=field.name.split('.');
    if(key)cv.content[section][key]=field.value;else cv[section]=field.value;
  });
  document.querySelectorAll<HTMLElement>('[data-rows]').forEach(container=>{
    const section=container.dataset.rows!;
    cv.content[section]=Array.from(container.querySelectorAll<HTMLElement>('.kcv-row'),row=>{
      if(!row.dataset.cvRowId)row.dataset.cvRowId=createCVId();
      const data:any={id:row.dataset.cvRowId};
      row.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-field]').forEach(field=>{data[field.dataset.field!]=field.value;});
      return data;
    });
  });
  return cv;
}
function fill(cv:any) {
  document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('#input-panel [name]').forEach(field=>{
    const [section = '',key]=field.name.split('.');
    field.value=String(key ? cv.content?.[section]?.[key]??'' : cv[section]??'');
  });
  document.querySelectorAll<HTMLElement>('[data-rows]').forEach(container=>{
    const section=container.dataset.rows!;
    container.replaceChildren();
    for(const item of cv.content?.[section]||[]){
      document.querySelector<HTMLButtonElement>('[data-add="'+section+'"]')?.click();
      const row=container.lastElementChild as HTMLElement;
      row.dataset.cvRowId=item.id||createCVId();
      row.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-field]').forEach(field=>{field.value=String(item[field.dataset.field!]??'');});
    }
  });
}
async function refresh(){
  const result=await driveRequest(api);
  select().replaceChildren(new Option('Chọn CV đã lưu',''));
  for(const item of result.items||[])select().add(new Option((item.label||item.targetCompany||'CV '+item.id.slice(0,8))+' · '+(item.updatedAt||''),item.id));
  status('Đã kết nối Google Drive · '+(result.items||[]).length+' phiên bản CV đã lưu.','success');
}
async function task(fn:()=>Promise<void>){
  try{await fn();}
  catch(e){
    const message=e instanceof Error?e.message:'Lỗi không xác định';
    status('Không thực hiện được: '+message+'. Nội dung đang nhập vẫn được giữ nguyên.','error');
    if(!connected())buttons(false);
  }
}
if(!configured(clientId,api)){
  btn('kcv-connect').disabled=true;
  status(!clientId
    ? 'Chức năng lưu chưa được kích hoạt: thiếu Google OAuth Client ID ở bản build. Vẫn có thể nhập và xem CV.'
    : 'Chức năng lưu chưa được kích hoạt: thiếu địa chỉ API Korea CV HTTPS ở bản build. Vẫn có thể nhập và xem CV.', 'error');
}else{
  status('Chưa kết nối · Nhấn “Kết nối Google” để lưu CV riêng tư. Có thể nhập hồ sơ trước.', 'neutral');
}
btn('kcv-connect').addEventListener('click',()=>task(async()=>{
  btn('kcv-connect').disabled=true;
  status('Đang yêu cầu quyền Google Drive appData…','info');
  try{
    await connectGoogle(clientId);
    // Authentication is not complete until a real authenticated Drive API read succeeds.
    await refresh();
    buttons(true);
  }finally{btn('kcv-connect').disabled=false;}
}));
btn('kcv-signout').addEventListener('click',()=>{disconnectGoogle();buttons(false);status('Đã ngắt kết nối · CV đang nhập chưa được lưu.','neutral');});
btn('kcv-new').addEventListener('click',()=>{
  if(!confirm('Tạo CV mới? Các thay đổi chưa lưu sẽ bị bỏ.'))return;
  fill({content:{}});currentId='';revision=-1;createdAt='';btn('input-tab').click();status('CV mới · Nội dung chưa được lưu.','info');
});
btn('kcv-save').addEventListener('click',()=>task(async()=>{
  if(!connected())throw new Error('Phiên Google đã hết hạn');
  const cv=capture();
  const result=await driveRequest(api,'/'+cv.id,'PUT',cv);
  if(!result.saved)throw new Error('Google Drive chưa xác nhận lưu');
  currentId=cv.id;revision=cv.revision;createdAt=cv.createdAt;
  status('Đã lưu thành công lên Google Drive · phiên bản '+revision+'.','success');
  await refresh();
}));
btn('kcv-refresh').addEventListener('click',()=>task(refresh));
select().addEventListener('change',()=>{
  for(const id of ['kcv-open','kcv-copy','kcv-remove'])btn(id).disabled=!select().value;
});
async function selected(){if(!select().value)throw new Error('Hãy chọn CV');return (await driveRequest(api,'/'+select().value)).cv;}
btn('kcv-open').addEventListener('click',()=>task(async()=>{
  const cv=await selected();fill(cv);currentId=cv.id;revision=cv.revision;createdAt=cv.createdAt||'';
  btn('input-tab').click();status('Đã mở CV từ Google Drive.','success');
}));
btn('kcv-copy').addEventListener('click',()=>task(async()=>{
  const cv=await selected();fill(cv);currentId='';revision=-1;createdAt='';
  const company=document.querySelector<HTMLInputElement>('[name="targetCompany"]');if(company)company.value='';
  const role=document.querySelector<HTMLInputElement>('[name="targetRole"]');if(role)role.value='';
  btn('input-tab').click();status('Đã nhân bản · Hãy nhập công ty mới và chọn “Lưu CV”.','info');
}));
btn('kcv-remove').addEventListener('click',()=>task(async()=>{
  const id=select().value;if(!id||!confirm('Xóa vĩnh viễn CV này khỏi Google Drive?'))return;
  const result=await driveRequest(api,'/'+id,'DELETE');
  if(!result.deleted)throw new Error('Chưa xác nhận xóa');
  if(currentId===id){currentId='';revision=-1;createdAt='';}
  await refresh();status('Đã xóa CV khỏi Google Drive.','success');
}));
