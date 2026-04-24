import ProductCard from "@/components/ProductCard";
import { ProductInput } from "@/components/ProductCard";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export default async function Home() {
  let products: ProductInput[] = [];
  let catalogAvailable = true;

  try {
    const res = await fetch(`${baseURL}/products`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Catalog request failed with ${res.status}`);
    }

    const productsData = await res.json();
    products = productsData?.products ?? [];
  } catch {
    catalogAvailable = false;
  }

  return (
    <div className="px-5 pb-12 pt-28">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <section className="mb-10 w-full rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,33,0.94),rgba(11,23,52,0.94),rgba(20,83,197,0.44))] px-6 py-12 text-center shadow-[0_25px_80px_rgba(2,6,23,0.45)]">
          <span className="mb-4 inline-flex rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1 text-sm font-medium uppercase tracking-[0.2em] text-blue-100">
            Blue Edition
          </span>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Shop the new blue, navy, and black storefront
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            A sharper e-commerce look with deep navy panels, electric blue
            accents, and bold dark surfaces across the store.
          </p>
        </section>

        <div className="mb-6 w-full">
          <h2 className="text-2xl font-semibold text-white">
            Featured Products
          </h2>
          <p className="mt-2 text-slate-300">
            {catalogAvailable
              ? "Browse the catalog in the refreshed theme."
              : "Theme preview is live. Connect a public backend URL to load products on Vercel."}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product: ProductInput) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </div>
  );
}
