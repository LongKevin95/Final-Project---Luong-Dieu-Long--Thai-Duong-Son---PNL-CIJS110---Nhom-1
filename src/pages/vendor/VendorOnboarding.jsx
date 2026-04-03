import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import "./VendorOnboarding.css";

const steps = [
  "Thông tin Shop",
  "Cài đặt vận chuyển",
  "Thông tin định danh",
  "Thông tin thuế",
  "Hoàn tất",
];

const emptyAddress = {
  fullName: "",
  phone: "",
  region: "",
  detail: "",
};

export default function VendorOnboarding() {
  const { updateRole } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [shopInfo, setShopInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [pickupAddress, setPickupAddress] = useState(emptyAddress);
  const [addressDraft, setAddressDraft] = useState(emptyAddress);
  const [errorMessage, setErrorMessage] = useState("");

  const addressLabel = useMemo(() => {
    if (!pickupAddress.fullName) {
      return "Chưa có địa chỉ lấy hàng";
    }

    return `${pickupAddress.fullName} | ${pickupAddress.phone} | ${pickupAddress.region} | ${pickupAddress.detail}`;
  }, [pickupAddress]);

  const handleShopInfoChange = (event) => {
    const { name, value } = event.target;
    setShopInfo((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleOpenModal = () => {
    setAddressDraft(pickupAddress.fullName ? pickupAddress : emptyAddress);
    setShowAddressModal(true);
  };

  const handleCloseModal = () => {
    setShowAddressModal(false);
  };

  const handleAddressChange = (event) => {
    const { name, value } = event.target;
    setAddressDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAddress = () => {
    const isValid = Object.values(addressDraft).every((value) => value.trim());

    if (!isValid) {
      window.alert("Vui lòng nhập đầy đủ thông tin địa chỉ lấy hàng.");
      return;
    }

    setPickupAddress(addressDraft);
    setShowAddressModal(false);
  };

  const handleNextFromShop = () => {
    if (!shopInfo.name || !shopInfo.email || !shopInfo.phone) {
      setErrorMessage("Vui lòng nhập đủ thông tin shop trước khi tiếp tục.");
      return;
    }

    if (!pickupAddress.fullName) {
      setErrorMessage("Vui lòng thêm địa chỉ lấy hàng.");
      return;
    }

    setCurrentStep(1);
  };

  const handleFinishTax = () => {
    setCurrentStep(4);
  };

  const handleAddProduct = async () => {
    try {
      await updateRole("vendor");
      navigate("/vendor/products");
    } catch (error) {
      window.alert(
        error?.message ?? "Chưa thể hoàn tất đăng ký. Vui lòng thử lại.",
      );
    }
  };

  return (
    <main className="vendor-onboarding">
      <div className="vendor-container">
        <header className="vendor-header">
          <h1>Đăng ký trở thành Người bán</h1>
        </header>

        <div className="vendor-steps">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`vendor-step ${index <= currentStep ? "is-active" : ""}`}
            >
              <span className="vendor-step__dot" />
              <span className="vendor-step__label">{label}</span>
            </div>
          ))}
        </div>

        {currentStep === 0 && (
          <section className="vendor-card">
            <div className="vendor-form">
              <label>
                Tên Shop
                <input
                  name="name"
                  type="text"
                  placeholder="Nhập tên shop"
                  value={shopInfo.name}
                  onChange={handleShopInfoChange}
                />
              </label>

              <div className="vendor-row">
                <label className="vendor-label">
                  Địa chỉ lấy hàng
                  <div className="vendor-address">
                    <span>{addressLabel}</span>
                    <button type="button" onClick={handleOpenModal}>
                      + Thêm
                    </button>
                  </div>
                </label>
              </div>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  placeholder="Nhập email"
                  value={shopInfo.email}
                  onChange={handleShopInfoChange}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  name="phone"
                  type="tel"
                  placeholder="Nhập số điện thoại"
                  value={shopInfo.phone}
                  onChange={handleShopInfoChange}
                />
              </label>

              {errorMessage && <p className="vendor-error">{errorMessage}</p>}

              <div className="vendor-actions">
                <button type="button" className="btn-muted">
                  Lưu
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNextFromShop}
                >
                  Tiếp theo
                </button>
              </div>
            </div>
          </section>
        )}

        {currentStep === 1 && (
          <section className="vendor-card">
            <h2>Cài đặt vận chuyển</h2>
            <div className="vendor-shipping">
              <div className="shipping-card">
                <div>
                  <h3>Hỏa tốc</h3>
                  <p>COD đã được kích hoạt</p>
                </div>
                <div className="shipping-toggles">
                  <label>
                    <input type="checkbox" defaultChecked />
                    Kích hoạt đơn vị vận chuyển này
                  </label>
                  <label>
                    <input type="checkbox" defaultChecked />
                    Kích hoạt COD
                  </label>
                </div>
              </div>
            </div>

            <div className="vendor-actions vendor-actions--split">
              <button
                type="button"
                className="btn-muted"
                onClick={() => setCurrentStep(0)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCurrentStep(2)}
              >
                Tiếp theo
              </button>
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="vendor-card vendor-card--center">
            <div className="vendor-info">
              Đây chỉ là giao diện tượng trưng, chưa làm chức năng xử lý!!!
            </div>
            <div className="vendor-identity">
              <div className="qr-box">QR</div>
              <ul>
                <li>Vui lòng quét mã QR để hoàn tất cập nhật thông tin.</li>
                <li>Đảm bảo bạn đã đăng nhập ứng dụng Shopee.</li>
              </ul>
            </div>
            <div className="vendor-actions vendor-actions--split">
              <button
                type="button"
                className="btn-muted"
                onClick={() => setCurrentStep(1)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCurrentStep(3)}
              >
                Tiếp theo
              </button>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="vendor-card">
            <div className="vendor-info">
              Đây chỉ là giao diện tượng trưng, chưa làm chức năng xử lý!!!
            </div>
            <div className="vendor-tax">
              <label>
                Loại hình kinh doanh
                <select>
                  <option>Cá nhân</option>
                  <option>Hộ kinh doanh</option>
                  <option>Công ty</option>
                </select>
              </label>
              <label>
                Địa chỉ đăng ký kinh doanh
                <input type="text" placeholder="Nhập địa chỉ" />
              </label>
              <label>
                Email nhận hóa đơn điện tử
                <input type="email" placeholder="Nhập email" />
              </label>
              <label>
                Mã số thuế
                <input type="text" placeholder="Nhập mã số thuế" />
              </label>
            </div>
            <div className="vendor-actions vendor-actions--split">
              <button
                type="button"
                className="btn-muted"
                onClick={() => setCurrentStep(2)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleFinishTax}
              >
                Hoàn tất
              </button>
            </div>
          </section>
        )}

        {currentStep === 4 && (
          <section className="vendor-card vendor-card--center">
            <div className="vendor-success">
              <div className="success-icon">✓</div>
              <h2>Đăng ký thành công</h2>
              <p>
                Hãy đăng bán sản phẩm đầu tiên để bắt đầu hành trình bán hàng.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddProduct}
              >
                Thêm sản phẩm
              </button>
            </div>
          </section>
        )}
      </div>

      {showAddressModal && (
        <div className="vendor-modal" role="dialog" aria-modal="true">
          <div className="vendor-modal__content">
            <div className="vendor-modal__header">
              <h3>Thêm Địa Chỉ Mới</h3>
              <button type="button" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className="vendor-modal__body">
              <label>
                Họ & Tên
                <input
                  name="fullName"
                  type="text"
                  placeholder="Nhập vào"
                  value={addressDraft.fullName}
                  onChange={handleAddressChange}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  name="phone"
                  type="text"
                  placeholder="Nhập vào"
                  value={addressDraft.phone}
                  onChange={handleAddressChange}
                />
              </label>
              <label>
                Tỉnh/Thành phố/Quận/Huyện/Phường/Xã
                <input
                  name="region"
                  type="text"
                  placeholder="Chọn"
                  value={addressDraft.region}
                  onChange={handleAddressChange}
                />
              </label>
              <label>
                Địa chỉ chi tiết
                <textarea
                  name="detail"
                  placeholder="Số nhà, tên đường..."
                  value={addressDraft.detail}
                  onChange={handleAddressChange}
                />
              </label>
            </div>

            <div className="vendor-modal__actions">
              <button
                type="button"
                className="btn-muted"
                onClick={handleCloseModal}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveAddress}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
