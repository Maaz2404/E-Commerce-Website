export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-6 mt-12 border-t-2 border-blue-700">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-blue-300">About Us</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Your trusted e-commerce platform for quality products and excellent customer service.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-blue-300">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-gray-300 hover:text-blue-300 transition">
                  Home
                </a>
              </li>
              <li>
                <a href="/cart" className="text-gray-300 hover:text-blue-300 transition">
                  Cart
                </a>
              </li>
              <li>
                <a href="/order-history" className="text-gray-300 hover:text-blue-300 transition">
                  Order History
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-blue-300">Contact</h3>
            <p className="text-gray-300 text-sm">
              Email: support@e-commerce.com<br />
              Phone: +92 312-241 7654
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-blue-700 pt-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              © 2026 E-Commerce Platform. All rights reserved.
            </p>
            <p className="text-blue-300 font-semibold mt-2">
              Developed by the Team Markhor
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
