import Image from "next/image";
import Link from "next/link";
import React from "react";
import { formatCurrency } from "@/lib/format";

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
      className="block max-w-md min-w-3xs rounded-lg overflow-hidden shadow-md p-4 bg-card hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer border border-border hover:border-ring"

    >
      <div className="w-full h-48 relative mb-4 rounded-lg overflow-hidden flex justify-center items-center bg-muted">

        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="100%"
          />
        ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold text-center mb-2 line-clamp-1 text-foreground">

        {name}
      </h2>

      {category && (
        <p className="text-xs text-center text-blue-600 dark:text-blue-400 mb-1 font-semibold uppercase tracking-wider">
          {category}
        </p>
      )}

      {description && (
        <p className="text-sm text-center mb-3 line-clamp-2 text-muted-foreground">
          {description}
        </p>
      )}

      <div className="flex justify-between items-center mt-4 gap-2">
        <span className="text-lg font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-3 py-1 rounded-lg">
          {formatCurrency(price)}
        </span>
        <span
          className={`text-sm font-semibold px-3 py-1 rounded-lg ${
            stock > 0
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50"
              : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50"
          }`}
        >
          {stock > 0 ? `${stock} Left` : "Out"}
        </span>
      </div>
    </Link>
  );
};

export default ProductCard;
