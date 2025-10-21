
import Image from 'next/image';
import React from 'react';

export interface ProductInput {
    id?:string | number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  image_url?: string;
}

const ProductCard = (props: ProductInput) => {
  const {
    name,
    description,
    price,
    stock,
    category,
    image_url,
  } = props;

  return (
    <div className="max-w-md min-w-3xs rounded overflow-hidden shadow-lg p-4 bg-white">
      <div className="w-full h-48 relative mb-4 rounded overflow-hidden">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover"
            sizes="100%"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}
      </div>
      <h2 className="text-xl font-semibold text-center mb-2">{name}</h2>
      {category && (
        <p className="text-sm text-center text-gray-500 mb-1">
          Category: {category}
        </p>
      )}
      {description && (
        <p className="text-gray-700 text-sm text-center overflow-auto mb-3">{description}</p>
      )}
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-green-600">${price.toFixed(2)}</span>
        <span
          className={`text-sm font-medium ${
            stock > 0 ? 'text-blue-600' : 'text-red-600'
          }`}
        >
          {stock > 0 ? `In Stock (${stock})` : 'Out of Stock'}
        </span>
      </div>
    </div>
  );
};

export default ProductCard;
