import { useAuth } from "../../hooks/useAuth";

export default function VendorProfile() {
  const { user } = useAuth();

  return (
    <div className="vendor-panel">
      <p>
        {user?.name || user?.email || "Vendor"} đang dùng trang hồ sơ. Tính năng
        chỉnh sửa profile sẽ được bổ sung ở bước tiếp theo.
      </p>
    </div>
  );
}
