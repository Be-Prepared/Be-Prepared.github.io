// Picks the best available translation for the browser's language list.
//
// navigator.languages is the person's whole preference list, most wanted
// first (for example ["pt-BR", "pt", "en-US", "en"]). The first entry that
// we can serve wins: an exact match ("pt-BR"), then the same language in
// any region ("pt" or "pt-PT" for "pt-BR"). Returns "" (the default
// language) when nothing matches.
export function chooseLanguage(
    preferences: readonly string[],
    available: readonly string[]
): string {
    const lower = available.map((tag) => tag.toLowerCase());

    for (const preference of preferences) {
        if (!preference) {
            continue;
        }

        const wanted = preference.toLowerCase();
        const exact = lower.indexOf(wanted);

        if (exact >= 0) {
            return available[exact];
        }

        const base = wanted.split('-')[0];
        const sameLanguage = lower.findIndex(
            (tag) => tag === base || tag.split('-')[0] === base
        );

        if (sameLanguage >= 0) {
            return available[sameLanguage];
        }
    }

    return '';
}
