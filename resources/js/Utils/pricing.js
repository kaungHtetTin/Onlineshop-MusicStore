export const skuPrice = (sku) => Number(sku?.flash_sale?.sale_price ?? sku?.effective_price ?? sku?.price ?? 0);

export const skuOriginalPrice = (sku) => Number(sku?.flash_sale?.original_price ?? sku?.price ?? 0);

export const hasFlashSale = (sku) => Boolean(sku?.flash_sale);

export const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
