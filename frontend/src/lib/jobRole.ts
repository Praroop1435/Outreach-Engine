// Mirrors job_role_from_notes in app/services/email_sender.py
const DEFAULT_ROLE = 'AI Engineer';
const ROLE_WORDS = /\b(engineer|developer|intern|internship|sde|programmer|scientist|architect)\b/i;
const SOURCE_TAG = /\s*\([^)]*(finder|founder|talent|remote|ppo|yc)[^)]*\)/gi;
const YC_ROLE = /^YC Work at a Startup:\s*([^.,[(]+)/;
const NOT_A_TITLE = /[|:]|https?:|\.$/;

// Notes mix role names with company blurbs and sourcing details; only a real title may reach a subject line
export function jobRoleFromNotes(notes?: string | null): string {
  let text = (notes || '').trim();
  const yc = text.match(YC_ROLE);
  if (yc) text = yc[1].trim();
  text = text.replace(SOURCE_TAG, '').replace(/ - /g, ', ').trim();
  const words = text.split(/\s+/).length;
  if (words > 6 || text.length > 60 || !ROLE_WORDS.test(text) || NOT_A_TITLE.test(text)) return DEFAULT_ROLE;
  return text;
}
