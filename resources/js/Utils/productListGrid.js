/**
 * User-side standard grid for product cards — matches Home “Best Sellers”.
 * - xs: 2 columns
 * - sm: 3 columns
 * - md: 4 columns
 * - lg and up: 5 columns
 */
export const DEFAULT_PRODUCT_LIST_GRID_GAP = 1.5;

export const productListGridTemplateColumns = {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
};

/** Use with MUI `sx`: spread then add margins etc. */
export const productListGridSx = {
    display: 'grid',
    gridTemplateColumns: productListGridTemplateColumns,
    gap: DEFAULT_PRODUCT_LIST_GRID_GAP,
};
