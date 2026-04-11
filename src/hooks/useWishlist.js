import { useContext } from "react";

import WishlistContext from "../contexts/wishlist-context";

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider.");
  }

  return context;
}
