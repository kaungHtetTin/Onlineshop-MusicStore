import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Client cart (Phase 4). Quantity is intentionally independent from live stock.
 * @typedef {{ skuId: number, productId: number, name: string, skuLabel: string, skuCode?: string|null, variantAttributes?: Record<string, string>, price: number, originalPrice?: number, flashSale?: object|null, imagePath: string|null, maxQty: number, isPreorder?: boolean, qty: number }} CartLine
 */

export const useCartStore = create(
    persist(
        (set, get) => ({
            orderQtyCap: 999,
            items: /** @type {CartLine[]} */ ([]),

            itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),

            /** @param {Omit<CartLine, 'qty'> & { qty?: number }} payload */
            addItem: (payload) => {
                const cap = get().orderQtyCap;
                const qty = Math.max(1, Math.min(cap, payload.qty ?? 1));
                set((state) => {
                    const idx = state.items.findIndex((i) => i.skuId === payload.skuId);
                    if (idx >= 0) {
                        const next = [...state.items];
                        const mergedCap = get().orderQtyCap;
                        const mergedQty = Math.min(mergedCap, next[idx].qty + qty);
                        next[idx] = {
                            ...next[idx],
                            qty: mergedQty,
                            maxQty: Number(payload.maxQty ?? 0),
                            isPreorder: Boolean(payload.isPreorder),
                            price: payload.price,
                            originalPrice: payload.originalPrice,
                            flashSale: payload.flashSale ?? null,
                            skuLabel: payload.skuLabel,
                            skuCode: payload.skuCode ?? null,
                            variantAttributes: payload.variantAttributes ?? {},
                        };
                        return { items: next };
                    }
                    return {
                        items: [
                            ...state.items,
                            {
                                skuId: payload.skuId,
                                productId: payload.productId,
                                name: payload.name,
                                skuLabel: payload.skuLabel,
                                skuCode: payload.skuCode ?? null,
                                variantAttributes: payload.variantAttributes ?? {},
                                price: payload.price,
                                originalPrice: payload.originalPrice,
                                flashSale: payload.flashSale ?? null,
                                imagePath: payload.imagePath,
                                maxQty: Number(payload.maxQty ?? 0),
                                isPreorder: Boolean(payload.isPreorder),
                                qty,
                            },
                        ],
                    };
                });
            },

            setQty: (skuId, qty) => {
                set((state) => ({
                    items: state.items
                        .map((i) =>
                            i.skuId === skuId
                                ? {
                                      ...i,
                                      qty: Math.max(
                                          1,
                                          Math.min(get().orderQtyCap, qty)
                                      ),
                                  }
                                : i
                        )
                        .filter((i) => i.qty > 0),
                }));
            },

            removeItem: (skuId) => {
                set((state) => ({
                    items: state.items.filter((i) => i.skuId !== skuId),
                }));
            },

            clear: () => set({ items: [] }),
        }),
        {
            name: 'lalapick-cart-v1',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ items: state.items }),
        }
    )
);
