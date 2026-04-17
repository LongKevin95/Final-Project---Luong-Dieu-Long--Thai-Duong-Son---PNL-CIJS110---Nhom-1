import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import AuthContext from "./auth-context";
import WishlistContext from "./wishlist-context";

const WISHLIST_STORAGE_KEY_PREFIX = "ls-ecommerce-wishlist-items";

function buildWishlistStorageKey(userEmail) {
  const normalizedEmail = String(userEmail ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return `${WISHLIST_STORAGE_KEY_PREFIX}::guest`;
  }

  return `${WISHLIST_STORAGE_KEY_PREFIX}::${normalizedEmail}`;
}

function readStoredWishlist(storageKey) {
  try {
    const rawData = window.localStorage.getItem(storageKey);

    if (!rawData) {
      return [];
    }

    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function normalizeWishlistItem(product) {
  return {
    productId: String(product?.id ?? product?.productId ?? "").trim(),
    title: String(product?.title ?? "Product"),
    price: Number(product?.price ?? 0),
    oldPrice: Number(product?.oldPrice ?? 0),
    image:
      product?.image ||
      (Array.isArray(product?.images) ? product.images[0] : "") ||
      "/favicon.svg",
    rating: Number(product?.rating ?? 0),
    reviews: Number(product?.reviews ?? 0),
    category: String(product?.category ?? ""),
    vendorEmail: String(product?.vendorEmail ?? "")
      .trim()
      .toLowerCase(),
    shopName:
      product?.shopName ||
      product?.vendorName ||
      (product?.vendorEmail ? String(product.vendorEmail).split("@")[0] : "L&S Store"),
  };
}

export function WishlistProvider({ children }) {
  const auth = useContext(AuthContext);
  const userEmail = auth?.user?.email;
  const storageKey = useMemo(
    () => buildWishlistStorageKey(userEmail),
    [userEmail],
  );

  const [items, setItems] = useState(() => readStoredWishlist(storageKey));

  useEffect(() => {
    setItems(readStoredWishlist(storageKey));
  }, [storageKey]);

  const syncItems = useCallback((updater) => {
    setItems((previousItems) => {
      const nextItems = updater(previousItems);
      window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
      return nextItems;
    });
  }, [storageKey]);

  const hasInWishlist = useCallback(
    (productId) => {
      const normalizedProductId = String(productId ?? "").trim();

      if (!normalizedProductId) {
        return false;
      }

      return items.some((item) => item.productId === normalizedProductId);
    },
    [items],
  );

  const addToWishlist = useCallback(
    (product) => {
      const nextItem = normalizeWishlistItem(product);

      if (!nextItem.productId) {
        return;
      }

      syncItems((previousItems) => {
        if (previousItems.some((item) => item.productId === nextItem.productId)) {
          return previousItems;
        }

        return [nextItem, ...previousItems];
      });
    },
    [syncItems],
  );

  const removeFromWishlist = useCallback(
    (productId) => {
      const normalizedProductId = String(productId ?? "").trim();

      if (!normalizedProductId) {
        return;
      }

      syncItems((previousItems) =>
        previousItems.filter((item) => item.productId !== normalizedProductId),
      );
    },
    [syncItems],
  );

  const toggleWishlistItem = useCallback(
    (product) => {
      const productId = String(product?.id ?? product?.productId ?? "").trim();

      if (!productId) {
        return;
      }

      if (hasInWishlist(productId)) {
        removeFromWishlist(productId);
        return false;
      }

      addToWishlist(product);
      return true;
    },
    [addToWishlist, hasInWishlist, removeFromWishlist],
  );

  const clearWishlist = useCallback(() => {
    syncItems(() => []);
  }, [syncItems]);

  const value = useMemo(
    () => ({
      items,
      totalItems: items.length,
      hasInWishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlistItem,
      clearWishlist,
    }),
    [addToWishlist, clearWishlist, hasInWishlist, items, removeFromWishlist, toggleWishlistItem],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export default WishlistProvider;
