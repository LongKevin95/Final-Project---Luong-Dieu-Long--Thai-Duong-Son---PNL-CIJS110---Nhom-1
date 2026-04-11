import { Link } from "react-router-dom";

import "./Footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="o-container">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-col__title">Exclusive</div>
            <div className="footer-col__subtitle">Subscribe</div>
            <div className="footer-text">Get 10% off your first order</div>

            <div className="footer-subscribe">
              <div className="footer-subscribe__field">
                <input type="email" placeholder="Enter your email" />
                <button type="button" aria-label="Send">
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-col__title">Support</div>
            <div className="footer-text">
              111 Bijoy sarani, Dhaka, DH 1515, Bangladesh.
            </div>
            <div className="footer-text footer-text--spaced">
              exclusive@gmail.com
            </div>
            <div className="footer-text footer-text--spaced">
              +88015-88888-9999
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-col__title">Account</div>
            <ul className="footer-list">
              <li>
                <a href="#">My Account</a>
              </li>
              <li>
                <Link to="/login">Login / Register</Link>
              </li>
              <li>
                <Link to="/cart">Cart</Link>
              </li>
              <li>
                <Link to="/wishlist">Wishlist</Link>
              </li>
              <li>
                <Link to="/vendor/dashboard">Vendor</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <div className="footer-col__title">Quick Link</div>
            <ul className="footer-list">
              <li>
                <a href="#">Privacy Policy</a>
              </li>
              <li>
                <a href="#">Terms Of Use</a>
              </li>
              <li>
                <a href="#">FAQ</a>
              </li>
              <li>
                <a href="#">Contact</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <div className="footer-col__title">Download App</div>
            <div className="footer-text">Save $3 with App New User Only</div>

            <div className="footer-download">
              <div className="footer-download__row">
                <div className="footer-qr" aria-hidden="true">
                  QR
                </div>

                <div className="store-badges" aria-hidden="true">
                  <div className="store-badge">Google Play</div>
                  <div className="store-badge">App Store</div>
                </div>
              </div>

              <div className="footer-social" aria-label="Social links">
                <a href="#" aria-label="Facebook">
                  Fb
                </a>
                <a href="#" aria-label="Twitter">
                  Tw
                </a>
                <a href="#" aria-label="Instagram">
                  Ig
                </a>
                <a href="#" aria-label="LinkedIn">
                  In
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          Copyright Rimel 2022. All right reserved
        </div>
      </div>
    </footer>
  );
}

export default Footer;
