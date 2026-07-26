export const skuPrice = (sku) => Number(sku?.flash_sale?.sale_price ?? sku?.effective_price ?? sku?.price ?? 0);

export const skuOriginalPrice = (sku) => Number(sku?.flash_sale?.original_price ?? sku?.price ?? 0);

export const hasFlashSale = (sku) => Boolean(sku?.flash_sale);

let currencyLabel = 'MMK';

export const configurePricing = (settings = {}) => {
    currencyLabel = String(settings.currency_label || 'MMK').trim();
};

export const formatMoney = (value) =>
    [
        Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
        currencyLabel,
    ].filter(Boolean).join(' ');
