import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { createOrder } from "../../api/ordersApi";
import { getAllProducts, updateProductById } from "../../api/productApi";
import "./Checkout.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const DELIVERY_FEE = 5;

const initialFormData = {
  country: "Vietnam",
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  phone: "",
  email: "",
  paymentMethod: "cash",
};

function Checkout() {
  const { user, isCustomer, isVendor } = useAuth();
  const queryClient = useQueryClient();
  const { items, subtotal, deleteAllItems, buildCartItemKey } = useCart();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);

  const canPurchase = isCustomer && !isVendor;
  const shipping = items.length > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + shipping;

  const requireAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: "/checkout" } });
      return false;
    }

    if (!canPurchase) {
      window.alert("Chi tai khoan customer moi co the checkout.");
      return false;
    }

    return true;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: "/checkout" }, replace: true });
      return;
    }

    if (!canPurchase) {
      navigate("/", { replace: true });
    }
  }, [canPurchase, navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!requireAccess()) return;

    if (items.length === 0) {
      window.alert("Giỏ hàng đang trống, không thể checkout.");
      navigate("/cart");
      return;
    }

    const requiredFields = [
      "country",
      "firstName",
      "lastName",
      "address",
      "city",
      "state",
      "zipCode",
      "phone",
      "email",
    ];

    const hasEmptyField = requiredFields.some(
      (field) => !String(formData[field] ?? "").trim(),
    );

    if (hasEmptyField) {
      window.alert("Vui lòng nhập đầy đủ thông tin để thanh toán.");
      return;
    }

    // Trừ stock cho từng sản phẩm khi thanh toán thành công
    try {
      const products = await getAllProducts();
      const stockByProductId = new Map(
        products.map((product) => [
          String(product?.id ?? ""),
          Number(product?.stock ?? 0),
        ]),
      );

      for (const item of items) {
        const productId = String(item?.productId ?? "").trim();
        const quantityToDeduct = Number(item?.quantity ?? 0);
        const currentStock = Number(stockByProductId.get(productId) ?? 0);

        if (!productId || quantityToDeduct <= 0) {
          window.alert("Dữ liệu giỏ hàng không hợp lệ. Vui lòng thử lại.");
          return;
        }

        if (currentStock < quantityToDeduct) {
          window.alert(
            `Sản phẩm trong giỏ đã thay đổi tồn kho. Chỉ còn ${currentStock} sản phẩm cho mã ${productId}.`,
          );
          navigate("/cart");
          return;
        }
      }

      for (const item of items) {
        const productId = String(item?.productId ?? "").trim();
        const quantityToDeduct = Number(item?.quantity ?? 0);
        const currentStock = Number(stockByProductId.get(productId) ?? 0);

        await updateProductById({
          id: productId,
          updates: {
            stock: currentStock - quantityToDeduct,
          },
        });
      }

      await createOrder({
        customerEmail: String(user?.email ?? "")
          .trim()
          .toLowerCase(),
        customerName: user?.name ?? user?.email ?? "Customer",
        status: "pending",
        paymentMethod: formData.paymentMethod,
        items: items.map((item) => ({
          productId: String(item?.productId ?? ""),
          title: item?.title ?? "Product",
          image: item?.image ?? "/favicon.svg",
          quantity: Number(item?.quantity ?? 0),
          price: Number(item?.price ?? 0),
          vendorEmail: String(item?.vendorEmail ?? "")
            .trim()
            .toLowerCase(),
          shopName: item?.shopName ?? "Shop",
          color: item?.color ?? "Default",
          size: item?.size ?? "M",
        })),
        total,
      });

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      console.error("Lỗi khi cập nhật stock:", error);
      window.alert(
        "Có lỗi xảy ra khi cập nhật số lượng sản phẩm. Vui lòng thử lại.",
      );
      return;
    }

    window.alert("Thanh toán thành công!");
    deleteAllItems();
    navigate("/");
  };

  return (
    <main className="checkout-page o-container">
      <form className="checkout-layout" onSubmit={handleSubmit}>
        <section className="checkout-form">
          <h1>Checkout</h1>

          <label>
            Country/Region
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="Country/Region"
            />
          </label>

          <div className="checkout-grid-two">
            <label>
              First name
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
              />
            </label>
            <label>
              Last name
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
              />
            </label>
          </div>

          <label>
            Address
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Address"
            />
          </label>

          <div className="checkout-grid-three">
            <label>
              City
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
            </label>
            <label>
              State
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
              />
            </label>
            <label>
              ZIP code
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="ZIP code"
              />
            </label>
          </div>

          <div className="checkout-grid-two">
            <label>
              Phone
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email"
              />
            </label>
          </div>

          <h2>Payment</h2>

          <div className="checkout-payment-options">
            <label className="checkout-payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={formData.paymentMethod === "cash"}
                onChange={handleChange}
              />
              <span>Cash on Delivery (COD)</span>
            </label>

            <label className="checkout-payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={formData.paymentMethod === "card"}
                onChange={handleChange}
              />
              <span>Card Payment</span>
            </label>
          </div>

          <p className="checkout-payment-note">
            Ban chi can chon phuong thuc thanh toan, khong can nhap thong tin the.
          </p>

          <button type="submit" className="checkout-submit">
            Place Order
          </button>
        </section>

        <aside className="checkout-summary">
          <h3>Order Summary</h3>

          <div className="checkout-product-list">
            {items.length === 0 ? (
              <div className="checkout-empty">
                <p>Giỏ hàng trống.</p>
                <Link to="/cart">Về giỏ hàng</Link>
              </div>
            ) : (
              items.map((item) => (
                <article
                  key={buildCartItemKey(item)}
                  className="checkout-product-item"
                >
                  <div className="checkout-product-item__image">
                    <img src={item.image} alt={item.title} />
                    <span>{item.quantity}</span>
                  </div>
                  <div className="checkout-product-item__content">
                    <h4>{item.title}</h4>
                    <small>
                      {item.size} / {item.color}
                    </small>
                  </div>
                  <strong>{currency.format(item.price * item.quantity)}</strong>
                </article>
              ))
            )}
          </div>

          <div className="checkout-summary__row">
            <span>Subtotal</span>
            <strong>{currency.format(subtotal)}</strong>
          </div>
          <div className="checkout-summary__row">
            <span>Shipping</span>
            <strong>{currency.format(shipping)}</strong>
          </div>
          <div className="checkout-summary__row checkout-summary__row--total">
            <span>Total</span>
            <strong>{currency.format(total)}</strong>
          </div>
        </aside>
      </form>
    </main>
  );
}

export default Checkout;
