import {driveRequest,connected} from '../lib/korea-cv-client.mjs';
import {savedCvSummary} from '../lib/korea-cv-preview.mjs';
const root=document.createElement('section');
root.className='kcv-panel';
root.id='kcv-saved-preview';
root.setAttribute('aria-label','Nội dung CV đã đồng bộ từ Google Drive');
root.style.cssText='background:#f5faf6;color:#191b20';
const heading=document.createElement('h2');heading.textContent='Nội dung đã lưu · Google Drive';
const state=document.createElement('p');state.textContent='Chọn một CV rồi nhấn Xem bản đã lưu.';
const open=document.createElement('button');open.type='button';open.textContent='Xem bản đã lưu';open.style.cssText='background:#123f68;color:white;border:0;border-radius:9px;padding:12px 16px;cursor:pointer';
const body=document.createElement('div');
root.append(heading,state,open,body);
document.querySelector('#saved-panel')?.append(root);
function textNode(tag:string,value:string){const node=document.createElement(tag);node.textContent=value;return node;}
function render(cv:any){
  const view=savedCvSummary(cv);
  body.replaceChildren();
  const summary=document.createElement('dl');summary.className='kcv-summary-grid';
  for(const [name,value] of view.fields){summary.append(textNode('dt',name),textNode('dd',value));}
  body.append(summary);
  for(const section of view.sections){
    const region=document.createElement('section');region.className='kcv-summary-section';
    region.append(textNode('h3',section.name));
    if(!section.items.length)region.append(textNode('p','Chưa nhập dữ liệu.'));
    else{const list=document.createElement('ul');for(const item of section.items)list.append(textNode('li',item));region.append(list);}
    body.append(region);
  }
  const essays=document.createElement('section');essays.className='kcv-summary-section';
  essays.append(textNode('h3','자기소개서 · Tự giới thiệu'));
  for(const [name,value] of view.essays){essays.append(textNode('h4',name),textNode('p',value||'Chưa nhập dữ liệu.'));}
  body.append(essays);
  state.textContent='Bản đã lưu trên Google Drive · revision '+view.revision;
}
open.addEventListener('click',async()=>{
  const id=(document.querySelector<HTMLSelectElement>('#kcv-select'))?.value;
  if(!id||!connected()){state.textContent='Kết nối Google Drive và chọn phiên bản CV trước.';return;}
  open.disabled=true;state.textContent='Đang tải bản đã lưu từ Drive…';body.replaceChildren();
  try{
    const result=await driveRequest(import.meta.env.PUBLIC_KOREA_CV_API_URL,'/'+id);
    render(result.cv);
  }catch(error){state.textContent='Không tải được CV: '+(error instanceof Error?error.message:'Lỗi không xác định');}
  finally{open.disabled=false;}
});
document.querySelector('#kcv-select')?.addEventListener('change',()=>{
  body.replaceChildren();state.textContent='Chọn Xem bản đã lưu để đọc dữ liệu mới nhất từ Google Drive.';
});
