import ProductCard from "@/components/ProductCard";
import { ProductInput } from "@/components/ProductCard";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function Home() {
  const res = await fetch(`${baseURL}/products`);
  const productsData = await res.json();
  const products: ProductInput[] = productsData?.products ?? [];
  console.log("API Base URL:", process.env.NEXT_PUBLIC_API_BASE_URL);
  return (
    <div className="pt-20 m-5 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-5">Welcome to the E-Commerce Website</h1>
      <div className="grid items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {products.map((product: ProductInput) => (
          <ProductCard key={product.id} {...product} />
        ))}
        

      </div>
    </div>
  );
}
