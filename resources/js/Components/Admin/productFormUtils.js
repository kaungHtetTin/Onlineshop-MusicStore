export function normalizeOptionKey(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
}

export function skuToken(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function skuPrefixFromTitle(title) {
    const t = String(title || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ');
    if (!t) return 'SKU';
    const parts = t.split(' ').filter(Boolean);
    const prefix = parts.length === 1 ? parts[0].slice(0, 6) : parts.map((p) => p[0]).join('').slice(0, 6);
    return prefix || 'SKU';
}

export function generateSkuCode({ title, attrs, optionNames, existing }) {
    const prefix = skuPrefixFromTitle(title);
    const parts = [];
    for (const n of optionNames) {
        const k = normalizeOptionKey(n);
        const v = attrs?.[k];
        if (v != null && String(v).trim() !== '') {
            parts.push(skuToken(v).slice(0, 8));
        }
    }
    const base = [prefix, ...parts].filter(Boolean).join('-') || prefix;
    let code = base;
    let i = 2;
    while (existing.has(code)) {
        code = `${base}-${i}`;
        i += 1;
    }
    existing.add(code);
    return code;
}

export function signatureForAttributes(attributes, optionNames) {
    const keys = optionNames.map((n) => normalizeOptionKey(n));
    const parts = [];
    for (const k of keys) {
        parts.push(`${k}:${attributes?.[k] ?? ''}`);
    }
    return parts.join('|');
}

export function buildCombinations(options) {
    const normalized = options
        .map((o) => ({
            name: o.name,
            key: normalizeOptionKey(o.name),
            values: Array.isArray(o.values)
                ? Array.from(
                      new Set(o.values.filter((v) => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())),
                  )
                : [],
        }))
        .filter((o) => o.key && o.values.length > 0);

    if (normalized.length === 0) return [];

    const combos = [{}];
    for (const opt of normalized) {
        const next = [];
        for (const c of combos) {
            for (const v of opt.values) {
                next.push({ ...c, [opt.key]: v });
            }
        }
        combos.splice(0, combos.length, ...next);
    }
    return combos;
}

export function variantLabel(attrs, optionNames) {
    const parts = [];
    for (const n of optionNames) {
        const k = normalizeOptionKey(n);
        const v = attrs?.[k];
        if (v != null && String(v) !== '') parts.push(String(v));
    }
    return parts.length > 0 ? parts.join(' / ') : 'Variant';
}
