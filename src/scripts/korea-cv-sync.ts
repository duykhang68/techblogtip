import {configured,connectGoogle,connected,disconnectGoogle,driveRequest,createCVId} from '../lib/korea-cv-client.mjs';

const element = (id:string) => document.getElementById(id) as HTMLElement;
const status = (value:string) => { element('service-status').textContent = value; };
const clientId=import.meta.env.PUBLIC_KOREA_CV_GOOGLE_CLIENT_ID || '';
const api=import.meta.env.PUBLIC_KOREA_CV_API_URL || '';
let currentId='';
let revision=-1;
const controls=document.createElement('div');
controls.className='kcv-actions';
controls.innerHTML='<button type="button" id="kcv-connect">Kết nối Google Drive</button> <button type="button" id="kcv-new" disabled>CV mới</button> <button type="button" id="kcv-save" disabled>Lưu lên Drive</button> <button type="button" id="kcv-signout" hidden>Ngắt kết nối</button>';
element('service-status').before(controls);
const savedPanel=element('saved-panel');
const manager=document.createElement('div');
manager.className='kcv-panel';
manager.innerHTML='<h2>CV theo từng công ty · Google Drive</h2><div class="kcv-actions"><button type="button" id="kcv-refresh" disabled>Tải danh sách</button><select id="kcv-select" aria-label="Chọn CV đã lưu"><option value="">Chưa có CV</option></select><button type="button" id="kcv-open" disabled>Mở bản lưu</button><button type="button" id="kcv-copy" disabled>Nhân bản CV</button><button type="button" id="kcv-remove" disabled>Xóa bản lưu</button></div>';
savedPanel.prepend(manager);
const btn=(id:string)=>element(id) as HTMLButtonElement;
const select=()=>element('kcv-select') as HTMLSelectElement;
function buttons(auth:boolean) {
  btn('kcv-connect').hidden=auth;btn('kcv-signout').hidden=!auth;
  for(const name of ['kcv-save','kcv-new','kcv-refresh'])btn(name).disabled=!auth;
}
function capture() {
  const cv:any={schemaVersion:1,id:currentId||createCVId(),label:'',targetCompany:'',targetRole:'',locale:'ko',revision:Math.max(0,revision+1),createdAt:'',updatedAt:new Date().toISOString(),content:{personal:{},essays:{},optionalSensitive:{},declarationOptional:null}};
  document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('#input-panel [name]').forEach(field=>{
    const [section,key]=field.name.split('.');
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
    const [section,key]=field.name.split('.');
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
  for(const item of result.items||[])select().add(new Option(item.id+' · '+(item.updatedAt||''),item.id));
  status('Đã tải '+(result.items||[]).length+' phiên bản từ Google Drive.');
}
async function task(fn:()=>Promise<void>){try{await fn();}catch(e){status('Lỗi: '+(e instanceof Error?e.message:'Không xác định')+'. Dữ liệu đang nhập chưa bị xóa.');}}
if(!configured(clientId,api)){btn('kcv-connect').disabled=true;status('Chưa cấu hình Google Client ID và Cloudflare API HTTPS. Không thể lưu CV.');}
btn('kcv-connect').addEventListener('click',()=>task(async()=>{
  await connectGoogle(clientId);buttons(true);status('Đã kết nối Google Drive.');await refresh();
}));
btn('kcv-signout').addEventListener('click',()=>{disconnectGoogle();buttons(false);status('Đã ngắt kết nối.');});
btn('kcv-new').addEventListener('click',()=>{
  if(!confirm('Tạo CV mới? Các thay đổi chưa lưu sẽ bị bỏ.'))return;
  fill({content:{}});currentId='';revision=-1;btn('input-tab').click();status('Đang nhập CV mới, chưa lưu.');
});
btn('kcv-save').addEventListener('click',()=>task(async()=>{
  if(!connected())throw new Error('Phiên Google đã hết hạn');
  const cv=capture();
  const result=await driveRequest(api,'/'+cv.id,'PUT',cv);
  if(!result.saved)throw new Error('Google Drive chưa xác nhận lưu');
  currentId=cv.id;revision=cv.revision;
  status('Đã lưu thành công lên Google Drive · revision '+revision);
  await refresh();
}));
btn('kcv-refresh').addEventListener('click',()=>task(refresh));
select().addEventListener('change',()=>{
  for(const id of ['kcv-open','kcv-copy','kcv-remove'])btn(id).disabled=!select().value;
});
async function selected(){if(!select().value)throw new Error('Hãy chọn CV');return (await driveRequest(api,'/'+select().value)).cv;}
btn('kcv-open').addEventListener('click',()=>task(async()=>{
  const cv=await selected();fill(cv);currentId=cv.id;revision=cv.revision;
  btn('input-tab').click();status('Đã đọc CV từ Google Drive.');
}));
btn('kcv-copy').addEventListener('click',()=>task(async()=>{
  const cv=await selected();fill(cv);currentId='';revision=-1;
  const company=document.querySelector<HTMLInputElement>('[name="targetCompany"]');if(company)company.value='';
  const role=document.querySelector<HTMLInputElement>('[name="targetRole"]');if(role)role.value='';
  btn('input-tab').click();status('Đã nhân bản bản lưu vào biểu mẫu. Nhập công ty mới rồi chọn lưu.');
}));
btn('kcv-remove').addEventListener('click',()=>task(async()=>{
  const id=select().value;if(!id||!confirm('Xóa vĩnh viễn CV này khỏi Google Drive?'))return;
  const result=await driveRequest(api,'/'+id,'DELETE');
  if(!result.deleted)throw new Error('Chưa xác nhận xóa');
  if(currentId===id){currentId='';revision=-1;}
  await refresh();status('Đã xóa CV.');
}));
