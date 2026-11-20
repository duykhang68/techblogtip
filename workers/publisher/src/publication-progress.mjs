// Shared pure model: verified stage gates. Also embedded in the client by ui.mjs.
export function publicationProgress(row={},inspection=null){
  const state=String(row.status||'DRAFT').trim().toUpperCase();
  const hasContent=!!(String(row.title||'').trim()||String(row.body||'').trim());
  const submitted=/^[a-f0-9]{64}$/.test(String(row.sourceHash||''))&&
    /^https:\/\/github\.com\/duykhang68\/techblogtip\/pull\/[1-9][0-9]*$/.test(String(row.draftPr||''));
  const ready=state==='READY'||state==='PUBLISHED'||submitted;
  const inspected=inspection&&inspection.sourceId===row.sourceId&&inspection.prUrl===row.draftPr;
  const pr=inspected?inspection:null;
  const ci=pr?.ci;
  const checks=Array.isArray(ci?.checks)?ci.checks:[];
  const ciExact=ci?.checkedSha===pr?.headSha&&/^[a-f0-9]{40}$/.test(pr?.headSha||'');
  const ciComplete=ciExact&&ci?.availability==='available'&&checks.length>0&&
    checks.some(check=>check.name==='Astro · Types · Content · Build')&&
    checks.every(check=>check.status==='completed'&&check.conclusion==='success');
  const ciFailed=ciExact&&checks.some(check=>check.status==='completed'&&
    ['failure','cancelled','timed_out','action_required','startup_failure'].includes(check.conclusion));
  const merged=pr?.stage==='merged';
  const published=merged&&ciComplete&&pr?.productionVerified===true&&
    /^https:\/\//.test(String(row.publishedUrl||''))&&
    /^[a-f0-9]{40}$/.test(String(row.releaseSha||''))&&
    !!String(row.publishedAt||'').trim();
  const labels=['Bản nháp','READY','Draft PR','CI đạt','Đã merge','Lên blog'];
  const done=[hasContent,ready,submitted,!!ciComplete,!!merged,!!published];
  const complete=done.filter(Boolean).length;
  const closed=pr?.stage==='closed_unmerged';
  const phase=published?'published':closed?'closed':ciFailed?'failed':
    merged?'merged':ciComplete?'ci':submitted?'pr':ready?'ready':'draft';
  const headline=published?'Đã đăng · xác minh production thành công':
    closed?'PR đã đóng không merge · bài chưa đăng':
    ciFailed?'CI không đạt · cần sửa PR':
    merged?'Đã merge · chờ xác minh production':
    ciComplete?'CI đạt · chờ review/merge':
    submitted?'Đã có Draft PR · kiểm tra CI':
    ready?'READY · chờ tạo Draft PR':
    hasContent?'Bản nháp · cần duyệt READY':'Chưa có nội dung bài';
  const hint=published?'Đã đối chiếu public release URL và exact SHA':
    closed?'PR đã đóng; không tự tạo lại hay đánh dấu đã xuất bản':
    merged?'Merge không có nghĩa đã xuất bản. Cần xác minh URL và SHA public':
    submitted?'Nhấn Cập nhật tiến độ để lấy trạng thái GitHub mới nhất':
    ready?'Bạn chủ động gửi Draft PR sau khi kiểm tra bài':
    'Tiếp tục biên tập và duyệt thủ công trong Google Sheets';
  const next=done.findIndex(x=>!x);
  const steps=labels.map((label,index)=>({
    label,done:done[index],
    state:done[index]?'done':index===next?'active':'pending',
  }));
  return {complete,total:6,percent:Math.round(complete/6*100),
    steps,phase,headline,hint,checkedSha:ciExact?pr.headSha:null,
    checked:!!pr,productionVerified:!!published};
}
