import {captureKoreaCvDraft} from './korea-cv-draft.mjs';

/** Explicit source selection. Unsaved form exports never call Google Drive. */
export async function resolveKoreaCvExport(root,{connected,driveRequest,api}) {
  const source=root.getElementById('kcv-export-source')?.value||'draft';
  if(source==='draft')return {cv:captureKoreaCvDraft(root),source};
  if(source!=='saved')throw new Error('Nguồn dữ liệu xuất không hợp lệ.');
  const id=root.getElementById('kcv-select')?.value;
  if(!id)throw new Error('Hãy chọn một CV trong thư viện trước khi xuất phiên bản đã lưu.');
  if(!connected())throw new Error('Hãy kết nối Google Drive để đọc phiên bản đã lưu.');
  const data=await driveRequest(api,'/'+id);
  if(!data?.cv)throw new Error('Google Drive không trả về bản CV đã chọn.');
  return {cv:data.cv,source,id};
}
