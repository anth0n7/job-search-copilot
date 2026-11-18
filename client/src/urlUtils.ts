//A link like href="acme.com" is treated as a path on our own site, so add https:// when no protocol was typed.
export function normalizeWebsite(url: string | null): string | undefined {
    if (!url || url.trim() === '') return undefined;
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
