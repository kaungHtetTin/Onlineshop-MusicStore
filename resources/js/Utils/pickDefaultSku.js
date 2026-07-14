/**
 * Pick a SKU for quick “add to cart” from listing cards: prefer cheapest in-stock active SKU.
 * @param {{ skus?: Array<{ id: number, price: string|number, stock_qty?: number, is_active?: boolean, attributes?: Record<string, string> }> }} product
 * @returns {null | { id: number, price: number, stock_qty: number, is_active?: boolean, attributes?: Record<string, string>, sku_code?: string }}
 */
export function pickDefaultSkuForProduct(product) {
    const skus = product?.skus || [];
    if (!skus.length) {
        return null;
    }

    const active = skus.filter((s) => s.is_active !== false);
    const pool = active.length ? active : skus;

    const inStock = pool.filter((s) => Number(s.stock_qty ?? 0) > 0);
    const pickFrom = inStock.length ? inStock : pool;

    return pickFrom.reduce((best, s) => {
        const p = parseFloat(s.flash_sale?.sale_price ?? s.effective_price ?? s.price);
        const bp = parseFloat(best.flash_sale?.sale_price ?? best.effective_price ?? best.price);
        return p < bp ? s : best;
    }, pickFrom[0]);
}
