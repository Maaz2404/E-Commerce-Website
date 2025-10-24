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
      className="block max-w-md min-w-3xs rounded overflow-hidden shadow-lg p-4 bg-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 cursor-pointer"
    >
      <div className="w-full h-48 relative mb-4 rounded overflow-hidden flex justify-center items-center bg-gray-100">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="100%"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-center mb-2 line-clamp-1">
        {name}
      </h2>

      {category && (
        <p className="text-sm text-center text-gray-500 mb-1">
          Category: {category}
        </p>
      )}

      {description && (
        <p className="text-gray-700 text-sm text-center mb-3 line-clamp-2">
          {description}
        </p>
      )}

      <div className="flex justify-between items-center mt-2">
        <span className="text-lg font-bold text-green-600">
          ${price.toFixed(2)}
        </span>
        <span
          className={`text-sm font-medium ${
            stock > 0 ? "text-blue-600" : "text-red-600"
          }`}
        >
          {stock > 0 ? `In Stock (${stock})` : "Out of Stock"}
        </span>
      </div>
    </Link>
  );
};

export default ProductCard;
