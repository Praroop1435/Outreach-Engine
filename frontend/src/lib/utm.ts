// Mirrors app/services/utm.py: UTM params go straight onto the real URL, no redirect.
// Values never include names or emails: campaign is the company slug, content is the lead id.

const URL_REGEX = /(https?:\/\/[^\s<>"')]+)/gi;
const TRAILING_PUNCT = /[.,;:!?]+$/;

export function slugify(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'prospect';
}

export function addUtm(url: string, campaign?: string | null, content?: string | null, medium = 'email', source = 'outreach') {
  try {
    const u = new URL(url);
    const params: Record<string, string | null | undefined> = {
      utm_source: source,
      utm_medium: medium,
      utm_campaign: slugify(campaign),
      utm_content: content,
    };
    for (const [k, v] of Object.entries(params)) {
      if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function tagLinks(text: string, campaign?: string | null, content?: string | null, medium = 'email') {
  return text.replace(URL_REGEX, raw => {
    const trailing = raw.match(TRAILING_PUNCT)?.[0] || '';
    const url = trailing ? raw.slice(0, -trailing.length) : raw;
    return addUtm(url, campaign, content, medium) + trailing;
  });
}
