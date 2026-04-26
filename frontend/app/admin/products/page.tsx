"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X, PlusCircle } from "lucide-react";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[] | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<number, any>>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    image_url: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const res = await fetch(`${baseURL}/products/`);
    const productsData = await res.json();
    setProducts(productsData.products);
  }

  const getToken = () => localStorage.getItem("token");

  const handleDelete = async (id: number) => {
    try {
      const token = getToken();
      const res = await fetch(`${baseURL}/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete product");
        return;
      }

      setProducts((prev) => prev?.filter((p) => p.id !== id) || []);
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleEditClick = (product: any) => {
    setEditingProductId(product.id);
    setEditedData((prev) => ({
      ...prev,
      [product.id]: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        image_url: product.image_url,
      },
    }));
  };

  const handleCancelEdit = () => setEditingProductId(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    id: number
  ) => {
    const { name, value } = e.target;
    setEditedData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [name]: value },
    }));
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const token = getToken();
      const updated = editedData[id];

      const res = await fetch(`${baseURL}/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || "Failed to update product");
        return;
      }

      setProducts((prev) =>
        prev?.map((p) => (p.id === id ? result : p)) || []
      );
      setEditingProductId(null);
    } catch (err) {
      console.error("Failed to update product:", err);
    }
  };

  const handleNewChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProduct((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      alert("Name and price are required!");
      return;
    }

    try {
      setLoading(true);
      const token = getToken();
      const res = await fetch(`${baseURL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newProduct,
          price: parseFloat(newProduct.price),
          stock: parseInt(newProduct.stock || "0"),
        }),
      });

      const result = await res.json();
      console.log('Add product response:', result, 'status:', res.status);
      if (!res.ok) {
        alert(result.error || "Failed to add product");
        return;
      }

      setProducts((prev) => (prev ? [result, ...prev] : [result]));
      setNewProduct({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "",
        image_url: "",
      });
    } catch (err) {
      console.error("Failed to add product:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-row gap-8 items-start w-full max-w-full">
      {/* LEFT SIDE - Product List */}
      <div className="flex-1 text-left">
        <h1 className="text-3xl font-bold w-full mb-6 text-center">
          Admin Products
        </h1>

        {products === null ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>No products found.</p>
        ) : (
          products.map((product: any) => {
            const isEditing = editingProductId === product.id;
            const currentData = editedData[product.id] || product;

            return (
              <div
                key={product.id}
                className="bg-white border p-4 my-2 w-full rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
              >
                <div className="flex-1">
                  {isEditing ? (
                    <>
                      <label className="text-sm font-medium text-gray-700">Name</label>
                      <input
                        name="name"
                        value={currentData.name}
                        onChange={(e) => handleChange(e, product.id)}
                        className="border p-2 mb-2 w-full rounded"
                      />

                      <label className="text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        name="description"
                        value={currentData.description}
                        onChange={(e) => handleChange(e, product.id)}
                        className="border p-2 mb-2 w-full rounded"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Price</label>
                          <input
                            name="price"
                            value={currentData.price}
                            onChange={(e) => handleChange(e, product.id)}
                            className="border p-2 mb-2 w-full rounded"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Stock</label>
                          <input
                            name="stock"
                            value={currentData.stock}
                            onChange={(e) => handleChange(e, product.id)}
                            className="border p-2 mb-2 w-full rounded"
                          />
                        </div>
                      </div>

                      <label className="text-sm font-medium text-gray-700">Category</label>
                      <input
                        name="category"
                        value={currentData.category}
                        onChange={(e) => handleChange(e, product.id)}
                        className="border p-2 mb-2 w-full rounded"
                      />

                      <label className="text-sm font-medium text-gray-700">Image URL</label>
                      <input
                        name="image_url"
                        value={currentData.image_url}
                        onChange={(e) => handleChange(e, product.id)}
                        className="border p-2 mb-2 w-full rounded"
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold">{product.name}</h2>
                      {product.description && (
                        <p className="text-gray-600">{product.description}</p>
                      )}
                      <p className="text-gray-800 font-bold mt-2">
                        ${product.price} <span className="text-sm text-gray-600">| Stock: {product.stock}</span>
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {product.category || "Uncategorized"}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-3 items-center">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(product.id)}
                        className="text-orange-500 hover:text-orange-700"
                        title="Save"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-500 hover:text-gray-800"
                        title="Cancel"
                      >
                        <X size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditClick(product)}
                        className="text-orange-500 hover:text-orange-700"
                        title="Edit"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
             );
           })
         )}
       </div>
 
       {/* RIGHT SIDE - Add Product Form */}
      <div className="w-full sm:w-96 border rounded-lg shadow-md p-6 bg-white self-start">
         <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">
           Add New Product
         </h2>
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">Name</label>
        <input
          name="name"
          value={newProduct.name}
          onChange={handleNewChange}
          placeholder="Name"
          className="border p-2 mb-1 w-full rounded"
        />

        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          name="description"
          value={newProduct.description}
          onChange={handleNewChange}
          placeholder="Description"
          className="border p-2 mb-1 w-full rounded"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Price</label>
            <input
              name="price"
              type="number"
              value={newProduct.price}
              onChange={handleNewChange}
              placeholder="Price"
              className="border p-2 mb-1 w-full rounded"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Stock</label>
            <input
              name="stock"
              type="number"
              value={newProduct.stock}
              onChange={handleNewChange}
              placeholder="Stock"
              
              className="border p-2 mb-1 w-full rounded"
            />
          </div>
        </div>

        <label className="text-sm font-medium text-gray-700">Category</label>
        <input
          name="category"
          value={newProduct.category}
          onChange={handleNewChange}
          placeholder="Category"
          className="border p-2 mb-1 w-full rounded"
        />

        <label className="text-sm font-medium text-gray-700">Image URL</label>
        <input
          name="image_url"
          value={newProduct.image_url}
          onChange={handleNewChange}
          placeholder="Image URL"
          className="border p-2 mb-1 w-full rounded"
        />

        <button
          onClick={handleAddProduct}
          disabled={loading}
          className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 transition disabled:bg-gray-400"
        >
          {loading ? "Adding..." : "Add Product"}
        </button>
      </div>
    </div>
  </div>
  );
}
