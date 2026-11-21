// Build a strictly text-only view model from the confirmed Google Drive CV.
// Never render applicant strings as HTML, copy them to an index, or save them locally.
export function savedCvSummary(cv) {
  if (!cv || cv.schemaVersion !== 1 || !cv.content || !cv.id) throw new Error('Invalid saved CV');
  const c=cv.content,p=c.personal||{},e=c.essays||{};
  const fields=[
    ['Công ty ứng tuyển',cv.targetCompany||'—'],['Vị trí',cv.targetRole||'—'],
    ['Họ tên tiếng Hàn',p.koreanName||'—'],['Họ tên quốc tế',p.englishName||'—'],
    ['Email',p.email||'—'],['Điện thoại',p.phone||'—']
  ];
  const sections=[
    ['Học vấn',c.education||[]],['Công việc',c.employment||[]],
    ['Dự án',c.projects||[]],['Chứng chỉ',c.certifications||[]],
    ['Ngoại ngữ',c.languages||[]],['Kỹ năng',c.skills||[]],
    ['Giải thưởng',c.awards||[]],['Đào tạo',c.training||[]],
    ['Bằng sáng chế',c.patents||[]],['Người tham chiếu',c.referees||[]],
    ['Nghiên cứu',c.research||[]],
  ].map(([name,items])=>({name,items:items.map(item=>Object.entries(item).filter(([key])=>key!=='id').map(([,value])=>String(value||'')).filter(Boolean).join(' · '))}));
  const essays=[
    ['성장과정',e.growth||''],['성격',e.personality||''],
    ['학교생활/사회생활',e.schoolSocial||''],['지원동기/이직사유',e.motivation||''],
    ['입사 후 포부',e.future||'']
  ];
  return {id:cv.id,revision:cv.revision,fields,sections,essays};
}
