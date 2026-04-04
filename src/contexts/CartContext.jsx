import { useCallback, useMemo, useState } from "react";

import CartContext from "./cart-context";

const CART_STORAGE_KEY = "ls-ecommerce-cart-items";

function readStoredCartItems() {
  try {
    const storedItems = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!storedItems) {
      return [];
    }

    const parsedItems = JSON.parse(storedItems);

    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems.filter(
      (item) =>
        item &&
        item.productId &&
        item.title &&
        Number(item.price) >= 0 &&
        Number(item.quantity) > 0,
    );
  } catch {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

function normalizeCartItem(product, quantity, selectedOptions = {}) {
  const nextQuantity = Math.max(1, Number(quantity) || 1);
  const normalizedColor = selectedOptions.color || "Default";
  const normalizedSize = selectedOptions.size || "M";

  return {
    productId: String(product.id),
    title: product.title,
    price: Number(product.price) || 0,
    quantity: nextQuantity,
    image:
      product.image ||
      (Array.isArray(product.images) ? product.images[0] : "") ||
      "/favicon.svg",
    color: normalizedColor,
    size: normalizedSize,
  };
}

function buildCartItemKey(item) {
  return `${item.productId}-${item.color}-${item.size}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCartItems);

  const syncItems = useCallback((updater) => {
    setItems((previousItems) => {
      const nextItems = updater(previousItems);
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
      return nextItems;
    });
  }, []);

  const addToCart = useCallback(
    (product, quantity = 1, selectedOptions = {}) => {
      if (!product?.id) return;

      const nextItem = normalizeCartItem(product, quantity, selectedOptions);
      const nextItemKey = buildCartItemKey(nextItem);

      syncItems((previousItems) => {
        const targetIndex = previousItems.findIndex(
          (item) => buildCartItemKey(item) === nextItemKey,
        );

        if (targetIndex < 0) {
          return [...previousItems, nextItem];
        }

        return previousItems.map((item, index) =>
          index === targetIndex
            ? {
                ...item,
                quantity: item.quantity + nextItem.quantity,
              }
            : item,
        );
      });
    },
    [syncItems],
  );

  const setItemQuantity = useCallback(
    (itemKey, quantity) => {
      const nextQuantity = Math.max(1, Number(quantity) || 1);

      syncItems((previousItems) =>
        previousItems.map((item) =>
          buildCartItemKey(item) === itemKey
            ? { ...item, quantity: nextQuantity }
            : item,
        ),
      );
    },
    [syncItems],
  );

  const increaseItemQuantity = useCallback(
    (itemKey) => {
      syncItems((previousItems) =>
        previousItems.map((item) =>
          buildCartItemKey(item) === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    },
    [syncItems],
  );

  const decreaseItemQuantity = useCallback(
    (itemKey) => {
      syncItems((previousItems) =>
        previousItems.map((item) =>
          buildCartItemKey(item) === itemKey
            ? { ...item, quantity: Math.max(1, item.quantity - 1) }
            : item,
        ),
      );
    },
    [syncItems],
  );

  const removeItem = useCallback(
    (itemKey) => {
      syncItems((previousItems) =>
        previousItems.filter((item) => buildCartItemKey(item) !== itemKey),
      );
    },
    [syncItems],
  );

  const deleteAllItems = useCallback(() => {
    syncItems(() => []);
  }, [syncItems]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      ),
    [items],
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      totalItems,
      subtotal,
      addToCart,
      setItemQuantity,
      increaseItemQuantity,
      decreaseItemQuantity,
      removeItem,
      deleteAllItems,
      buildCartItemKey,
    }),
    [
      addToCart,
      decreaseItemQuantity,
      deleteAllItems,
      increaseItemQuantity,
      items,
      removeItem,
      setItemQuantity,
      subtotal,
      totalItems,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export default CartProvider;
