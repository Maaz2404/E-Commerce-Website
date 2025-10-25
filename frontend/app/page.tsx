import ProductCard from "@/components/ProductCard";
import { ProductInput } from "@/components/ProductCard";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export default async function Home() {
  const res = await fetch(`${baseURL}/products`);
  const productsData = await res.json();
  const products: ProductInput[] = productsData?.products ?? [];

  return (
    <div className="pt-20">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-orange-400 to-orange-600 text-white py-16 px-5">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to Daraz-Style E-Commerce</h1>
          <p className="text-lg md:text-xl mb-8">Discover amazing products at unbeatable prices</p>
          <div className="flex justify-center">
            <input
              type="text"
              placeholder="Search for products..."
              className="w-full max-w-md px-4 py-2 rounded-l-lg text-black focus:outline-none"
            />
            <button className="bg-orange-700 hover:bg-orange-800 px-6 py-2 rounded-r-lg font-semibold">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 px-5 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {["Electronics", "Fashion", "Home & Garden", "Sports", "Books", "Health"].map((category) => (
              <div key={category} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
                <p className="font-semibold text-gray-700">{category}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Featured Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {products.map((product: ProductInput) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
