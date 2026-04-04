import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import "./Cart.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const DELIVERY_FEE = 5;

function Cart() {
  const { user, isCustomer, isVendor } = useAuth();
  const { data: products = [] } = useProductsQuery();
  const {
    items,
    subtotal,
    increaseItemQuantity,
    decreaseItemQuantity,
    removeItem,
    deleteAllItems,
    buildCartItemKey,
  } = useCart();
  const navigate = useNavigate();
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMessage, setStockMessage] = useState("");

  const stockByProductId = useMemo(
    () =>
      new Map(
        products.map((product) => [
          String(product?.id ?? ""),
          Number(product?.stock ?? 0),
        ]),
      ),
    [products],
  );

  const canPurchase = isCustomer || isVendor;
  const total = subtotal + (items.length > 0 ? DELIVERY_FEE : 0);

  const requireAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return false;
    }

    if (!canPurchase) {
      window.alert("Chỉ customer hoặc vendor mới có thể dùng giỏ hàng.");
      return false;
    }

    return true;
  };

  const handleCheckout = () => {
    if (!requireAccess()) return;

    if (items.length === 0) {
      window.alert("Giỏ hàng đang trống.");
      return;
    }

    navigate("/checkout");
  };

  return (
    <main className="cart-page o-container">
      <nav className="cart-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>&gt;</span>
        <strong>Cart</strong>
      </nav>

      <h1 className="cart-title">YOUR CART</h1>

      <section className="cart-layout">
        <div className="cart-list">
          {items.length === 0 ? (
            <div className="cart-empty">
              <p>Giỏ hàng của bạn đang trống.</p>
              <Link to="/" className="cart-empty__btn">
                Về trang chủ
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const itemKey = buildCartItemKey(item);
              const currentStock = Number(
                stockByProductId.get(String(item.productId)) ?? item.stock ?? 0,
              );
              const isReachedStockLimit = item.quantity >= currentStock;

              return (
                <article key={itemKey} className="cart-item">
                  <button
                    type="button"
                    className="cart-item__remove"
                    aria-label="Remove item"
                    onClick={() => removeItem(itemKey)}
                  >
                    <span aria-hidden="true">Xóa</span>
                  </button>

                  <div className="cart-item__media">
                    <img src={item.image} alt={item.title} />
                  </div>

                  <div className="cart-item__content">
                    <h2>{item.title}</h2>
                    <p>
                      Size: <span>{item.size}</span>
                    </p>
                    <p>
                      Color: <span>{item.color}</span>
                    </p>
                    <strong>{currency.format(item.price)}</strong>
                  </div>

                  <div className="cart-item__actions">
                    <div
                      className="cart-item__quantity"
                      role="group"
                      aria-label="Quantity"
                    >
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => decreaseItemQuantity(itemKey)}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        aria-disabled={isReachedStockLimit}
                        onClick={() => {
                          if (item.quantity >= currentStock) {
                            setStockMessage(
                              `Chỉ còn ${currentStock} sản phẩm.`,
                            );
                            setShowStockModal(true);
                          } else {
                            increaseItemQuantity(itemKey);
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <aside className="cart-summary">
          <h3>Order Summary</h3>

          <div className="cart-summary__row">
            <span>Subtotal</span>
            <strong>{currency.format(subtotal)}</strong>
          </div>

          <div className="cart-summary__row">
            <span>Delivery Fee</span>
            <strong>
              {currency.format(items.length > 0 ? DELIVERY_FEE : 0)}
            </strong>
          </div>

          <div className="cart-summary__row cart-summary__row--total">
            <span>Total</span>
            <strong>{currency.format(total)}</strong>
          </div>

          <div className="cart-summary__actions">
            <button
              type="button"
              className="btn-delete"
              onClick={deleteAllItems}
            >
              Delete All
            </button>
            <button
              type="button"
              className="btn-checkout"
              onClick={handleCheckout}
            >
              Checkout
            </button>
            <Link to="/" className="btn-home">
              Home
            </Link>
          </div>
        </aside>
      </section>

      {showStockModal && (
        <div
          className="stock-modal-overlay"
          onClick={() => setShowStockModal(false)}
        >
          <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
            <p>{stockMessage}</p>
            <button onClick={() => setShowStockModal(false)}>Đóng</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default Cart;
