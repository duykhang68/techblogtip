import {createCVId} from './korea-cv-client.mjs';

/**
 * Create a complete Korean CV snapshot from the editable form, without
 * requiring Google OAuth or modifying the current saved Drive revision.
 * Used by Save, PDF and Excel to prevent diverging data paths.
 */
export function captureKoreaCvDraft(root, options={}) {
  const stamp=new Date().toISOString();
  const cv={
    schemaVersion:1,id:options.id||createCVId(),label:'',targetCompany:'',targetRole:'',
    locale:'ko',revision:Number.isInteger(options.revision)?options.revision:0,
    createdAt:options.createdAt||stamp,updatedAt:stamp,
    content:{personal:{},essays:{},optionalSensitive:{},declarationOptional:null,
      education:[],employment:[],certifications:[],languages:[],projects:[],
      skills:[],awards:[],training:[],patents:[],referees:[],research:[]},
  };
  root.querySelectorAll('#input-panel [name]').forEach(field=>{
    const [section,key]=field.name.split('.');
    if(key && (section==='personal'||section==='essays')) cv.content[section][key]=field.value;
    else if(!key && ['label','targetCompany','targetRole','locale'].includes(section)) cv[section]=field.value;
  });
  root.querySelectorAll('[data-rows]').forEach(container=>{
    const section=container.dataset.rows;
    if(!Object.hasOwn(cv.content,section)||!Array.isArray(cv.content[section]))return;
    cv.content[section]=Array.from(container.querySelectorAll('.kcv-row'),row=>{
      const id=row.dataset.cvRowId||createCVId();
      row.dataset.cvRowId=id;
      const record={id};
      row.querySelectorAll('[data-field]').forEach(field=>{
        if(field.dataset.field)record[field.dataset.field]=field.value;
      });
      return record;
    });
  });
  return cv;
}
