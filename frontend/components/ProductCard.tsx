import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Heart, Star } from "lucide-react";

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
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <Link href={`/product/${id}`} className="block">
        <div className="relative">
          <div className="w-full h-48 relative bg-gray-100 flex justify-center items-center">
            {image_url ? (
              <Image
                src={image_url}
                alt={name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="100%"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span className="text-4xl">📦</span>
              </div>
            )}
          </div>

          {/* Wishlist Button */}
          <button className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors" aria-label="Add to wishlist">
            <Heart size={16} className="text-gray-400 hover:text-red-500" />
          </button>

          {/* Stock Badge */}
          {stock <= 5 && stock > 0 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
              Only {stock} left!
            </div>
          )}
        </div>

        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2 hover:text-orange-600 transition-colors">
            {name}
          </h2>

          {category && (
            <p className="text-sm text-orange-600 font-medium mb-2">
              {category}
            </p>
          )}

          {/* Rating */}
          <div className="flex items-center mb-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <span className="text-sm text-gray-500 ml-1">(4.5)</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <span className="text-xl font-bold text-green-600">
                ${price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500 line-through ml-2">
                ${(price * 1.2).toFixed(2)}
              </span>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                stock > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {stock > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          {/* Free Shipping Badge */}
          <div className="mt-2 text-xs text-green-600 font-medium">
            ✓ Free Shipping
          </div>
        </div>
      </Link>

      {/* Quick Add to Cart Button */}
      <div className="px-4 pb-4">
        <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded transition-colors">
          Add to Cart
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
