"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, PlusCircle, Trash2, X } from "lucide-react";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
    const res = await fetch(`${baseURL}/products`);
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

  const handleNewChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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
    <div className="flex w-full max-w-full flex-1 flex-row gap-8 p-10 text-center">
      <div className="flex-1 text-left">
        <h1 className="mb-6 w-full text-center text-3xl font-bold text-white">
          Admin Products
        </h1>

        {products === null ? (
          <p className="text-slate-300">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-slate-300">No products found.</p>
        ) : (
          products.map((product: any) => {
            const isEditing = editingProductId === product.id;
            const currentData = editedData[product.id] || product;

            return (
              <div
                key={product.id}
                className="my-2 flex w-full items-start justify-between rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,19,38,0.92),rgba(4,8,16,0.96))] p-4 shadow-[0_12px_35px_rgba(2,6,23,0.25)]"
              >
                <div className="flex-1">
                  {isEditing ? (
                    <>
                      <input
                        name="name"
                        value={currentData.name}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                      <textarea
                        name="description"
                        value={currentData.description}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                      <input
                        name="price"
                        value={currentData.price}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                      <input
                        name="stock"
                        value={currentData.stock}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                      <input
                        name="category"
                        value={currentData.category}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                      <input
                        name="image_url"
                        value={currentData.image_url}
                        onChange={(e) => handleChange(e, product.id)}
                        className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-white">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="text-slate-300">{product.description}</p>
                      )}
                      <p className="font-bold text-slate-100">
                        ${product.price} | Stock: {product.stock}
                      </p>
                      <p className="text-sm text-blue-100/75">
                        {product.category || "Uncategorized"}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(product.id)}
                        className="text-cyan-200 transition hover:text-cyan-100"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-rose-300 transition hover:text-rose-200"
                      >
                        <X size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditClick(product)}
                        className="text-blue-300 transition hover:text-blue-200"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-rose-300 transition hover:text-rose-200"
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

      <div className="w-1/3 self-start rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,19,38,0.94),rgba(4,8,16,0.98))] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.3)]">
        <h2 className="mb-4 text-center text-xl font-bold text-white">
          Add New Product
        </h2>

        <input
          name="name"
          value={newProduct.name}
          onChange={handleNewChange}
          placeholder="Name"
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />
        <textarea
          name="description"
          value={newProduct.description}
          onChange={handleNewChange}
          placeholder="Description"
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />
        <input
          name="price"
          type="number"
          value={newProduct.price}
          onChange={handleNewChange}
          placeholder="Price"
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />
        <input
          name="stock"
          type="number"
          value={newProduct.stock}
          onChange={handleNewChange}
          placeholder="Stock"
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />
        <input
          name="category"
          value={newProduct.category}
          onChange={handleNewChange}
          placeholder="Category"
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />
        <input
          name="image_url"
          value={newProduct.image_url}
          onChange={handleNewChange}
          placeholder="Image URL"
          className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950/70 p-2 text-slate-100"
        />

        <button
          onClick={handleAddProduct}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-[0_14px_32px_rgba(37,99,235,0.35)] transition hover:bg-accent"
        >
          <PlusCircle size={18} />
          {loading ? "Adding..." : "Add Product"}
        </button>
      </div>
    </div>
  );
}
