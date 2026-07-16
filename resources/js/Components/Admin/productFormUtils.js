export function normalizeOptionKey(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
}

function skuToken(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function skuPrefixFromTitle(title) {
    const words = String(title || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) return 'SKU';
    if (words.length === 1) return words[0].slice(0, 8);
    return words.map((word) => word[0]).join('').slice(0, 8);
}

function generateSkuCode(title, attributes, optionNames, usedCodes) {
    const attributeTokens = optionNames
        .map((name) => skuToken(attributes?.[normalizeOptionKey(name)]).slice(0, 10))
        .filter(Boolean);
    const base = [skuPrefixFromTitle(title), ...attributeTokens].join('-');
    let candidate = base;
    let suffix = 2;

    while (usedCodes.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    usedCodes.add(candidate);
    return candidate;
}

export function refreshAutoSkuCodes(skus, title, optionNames) {
    const usedCodes = new Set(
        skus
            .filter((sku) => !sku.sku_code_auto && sku.sku_code)
            .map((sku) => String(sku.sku_code).trim().toUpperCase()),
    );

    return skus.map((sku) => (
        sku.sku_code_auto
            ? { ...sku, sku_code: generateSkuCode(title, sku.attributes, optionNames, usedCodes) }
            : sku
    ));
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
