import Image from "next/image";
import Link from "next/link";
import React from "react";

export interface ProductInput {
  id?: string | number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  image_url?: string;
}

const ProductCard = (props: ProductInput) => {
  const { id, name, description, price, stock, category, image_url } = props;

  return (
    <Link
      href={`/product/${id}`}
      className="block min-w-3xs max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(12,22,44,0.96),rgba(4,9,18,0.96))] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.35)] transition-all duration-200 hover:scale-[1.02] hover:border-blue-300/30 hover:shadow-[0_24px_60px_rgba(37,99,235,0.2)]"
    >
      <div className="relative mb-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(30,41,59,0.9),rgba(7,12,20,0.95))]">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="100%"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
      </div>

      <h2 className="mb-2 line-clamp-1 text-center text-xl font-semibold text-white">
        {name}
      </h2>

      {category && (
        <p className="mb-1 text-center text-sm text-blue-100/80">
          Category: {category}
        </p>
      )}

      {description && (
        <p className="mb-3 line-clamp-2 text-center text-sm text-slate-300">
          {description}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-lg font-bold text-blue-300">
          ${price.toFixed(2)}
        </span>
        <span
          className={`text-sm font-medium ${
            stock > 0 ? "text-cyan-200" : "text-rose-300"
          }`}
        >
          {stock > 0 ? `In Stock (${stock})` : "Out of Stock"}
        </span>
      </div>
    </Link>
  );
};

export default ProductCard;
