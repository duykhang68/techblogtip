// Korea CV Maker — blank-only schema and validation. Never populate with sample employers or applicants.
export const CV_SCHEMA_VERSION = 1;
export const ESSAY_KEYS = Object.freeze(['growth', 'personality', 'schoolSocial', 'motivation', 'future']);
export const REPEATABLE_FIELDS = Object.freeze(['education','employment','certifications','languages','projects','skills','awards','training','patents','referees','research']);
export const PERSONAL_KEYS = Object.freeze(['koreanName','englishName','hanjaName','dateOfBirth','email','phone','address','preferredLocation','availableFrom']);
export const OPTIONAL_SENSITIVE_KEYS = Object.freeze(['military','veteranStatus','disabilityStatus']);

export function blankCv(id = crypto.randomUUID()) {
  return {
    schemaVersion: CV_SCHEMA_VERSION,
    id, label: '', targetCompany: '', targetRole: '', locale: 'ko',
    createdAt: '', updatedAt: '', revision: 0,
    content: {
      personal: Object.fromEntries(PERSONAL_KEYS.map(key => [key, ''])),
      essays: Object.fromEntries(ESSAY_KEYS.map(key => [key, ''])),
      ...Object.fromEntries(REPEATABLE_FIELDS.map(key => [key, []])),
      optionalSensitive: {}, declarationOptional: null,
    },
  };
}

export function validateCv(input) {
  const issues = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['CV must be an object'];
  if (input.schemaVersion !== CV_SCHEMA_VERSION) issues.push('Unsupported schema version');
  if (typeof input.id !== 'string' || !/^[\w-]{8,80}$/.test(input.id)) issues.push('Invalid id');
  for (const key of ['label', 'targetCompany', 'targetRole', 'locale']) {
    if (typeof input[key] !== 'string' || input[key].length > 500) issues.push('Invalid ' + key);
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) issues.push('Invalid revision');
  const c = input.content;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [...issues, 'Invalid content'];
  for (const key of PERSONAL_KEYS) {
    if (typeof c.personal?.[key] !== 'string' || c.personal[key].length > 2000) issues.push('Invalid personal.' + key);
  }
  for (const key of ESSAY_KEYS) {
    if (typeof c.essays?.[key] !== 'string' || c.essays[key].length > 15000) issues.push('Invalid essays.' + key);
  }
  for (const key of REPEATABLE_FIELDS) {
    if (!Array.isArray(c[key]) || c[key].length > 100) { issues.push('Invalid collection ' + key); continue; }
    for (const [i, row] of c[key].entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { issues.push('Invalid row ' + key + '[' + i + ']'); continue; }
      if (typeof row.id !== 'string' || !/^[\w-]{8,80}$/.test(row.id)) issues.push('Invalid row id ' + key + '[' + i + ']');
      for (const [field, value] of Object.entries(row)) {
        if (field !== 'id' && (typeof value !== 'string' || value.length > 15000)) issues.push('Invalid field ' + key + '[' + i + '].' + field);
      }
    }
  }
  if (!c.optionalSensitive || typeof c.optionalSensitive !== 'object' || Array.isArray(c.optionalSensitive)) issues.push('Invalid optionalSensitive');
  else for (const key of Object.keys(c.optionalSensitive)) {
    if (!OPTIONAL_SENSITIVE_KEYS.includes(key) || typeof c.optionalSensitive[key] !== 'string') issues.push('Invalid optional sensitive field');
  }
  if (c.declarationOptional !== null && typeof c.declarationOptional !== 'string') issues.push('Invalid optional declaration');
  return issues;
}

// Never automatically copy any sample employer, Samsung-related content, or personal data.
export function duplicateCv(source, id = crypto.randomUUID()) {
  const issues = validateCv(source);
  if (issues.length) throw new TypeError(issues.join('; '));
  const clone = structuredClone(source);
  clone.id = id;
  clone.label = '';
  clone.targetCompany = '';
  clone.targetRole = '';
  clone.createdAt = '';
  clone.updatedAt = '';
  clone.revision = 0;
  return clone;
}
