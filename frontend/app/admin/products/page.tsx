"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000";

type Toast = { id: number; type: "success" | "error"; message: string };

const inputCls =
  "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-orange-400";

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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const res = await fetch(`${baseURL}/products/`);
      const productsData = await res.json();

      // Handle 404 (no products) gracefully
      if (res.status === 404) {
        setProducts([]);
        return;
      }

      if (!res.ok) {
        console.error("Failed to load products:", productsData);
        setProducts([]);
        return;
      }

      setProducts(productsData.products || []);
    } catch (err) {
      console.error("Error loading products:", err);
      setProducts([]);
    }
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
        addToast("error", err.error || "Failed to delete product");
        return;
      }

      setProducts((prev) => prev?.filter((p) => p.id !== id) || []);
      addToast("success", "Product deleted.");
    } catch (err) {
      console.error("Failed to delete product:", err);
      addToast("error", "Network error while deleting.");
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
        addToast("error", result.error || "Failed to update product");
        return;
      }

      setProducts((prev) =>
        prev?.map((p) => (p.id === id ? result : p)) || []
      );
      setEditingProductId(null);
      addToast("success", "Product updated.");
    } catch (err) {
      console.error("Failed to update product:", err);
    }
  };

  const handleNewChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProduct((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) {
      addToast("error", "Product name is required.");
      return;
    }
    const parsedPrice = parseFloat(newProduct.price);
    if (!newProduct.price || isNaN(parsedPrice) || parsedPrice <= 0) {
      addToast("error", "A valid price greater than 0 is required.");
      return;
    }

    try {
      setLoading(true);
      const token = getToken();

      console.log("🚀 Sending POST request to:", `${baseURL}/products/`);
      console.log("📦 Request body:", {
        name: newProduct.name.trim(),
        description: newProduct.description.trim(),
        price: parsedPrice,
        stock: parseInt(newProduct.stock || "0", 10),
        category: newProduct.category.trim(),
        image_url: newProduct.image_url.trim(),
      });

      const res = await fetch(`${baseURL}/products/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          description: newProduct.description.trim(),
          price: parsedPrice,
          stock: parseInt(newProduct.stock || "0", 10),
          category: newProduct.category.trim(),
          image_url: newProduct.image_url.trim(),
        }),
      });

      console.log("📡 Response status:", res.status, res.statusText);
      console.log("✅ Response ok?", res.ok);

      const result = await res.json();
      console.log("📥 Response data:", result);

      if (!res.ok) {
        console.error("❌ Request failed:", result.error || "Failed to add product");
        addToast("error", result.error || "Failed to add product");
        return;
      }

      console.log("✅ Product added successfully, updating state...");
      setProducts((prev) => (prev ? [result, ...prev] : [result]));
      setNewProduct({ name: "", description: "", price: "", stock: "", category: "", image_url: "" });
      addToast("success", `"${result.name}" added successfully!`);
    } catch (err) {
      console.error("💥 Exception caught in handleAddProduct:", err);
      console.error("Error name:", err instanceof Error ? err.name : 'unknown');
      console.error("Error message:", err instanceof Error ? err.message : err);
      addToast("error", "Network error while adding product.");
    } finally {
      setLoading(false);
      console.log("🏁 handleAddProduct completed");
    }
  };

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-24 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white pointer-events-auto transition-all ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="p-4 md:p-6 flex flex-col lg:flex-row gap-6 items-start w-full max-w-full">
        {/* LEFT SIDE - Product List */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold w-full mb-6 text-center text-slate-900 dark:text-slate-50">
            Admin Products
          </h1>

          {products === null ? (
            <p className="text-slate-600 dark:text-slate-300">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300">No products found.</p>
          ) : (
            products.map((product: any) => {
              const isEditing = editingProductId === product.id;
              const currentData = editedData[product.id] || product;

              return (
                <div
                  key={product.id}
                  className="bg-card border border-border p-4 my-2 w-full rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Name</label>
                          <input name="name" value={currentData.name} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <textarea name="description" value={currentData.description} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Price</label>
                            <input name="price" type="number" value={currentData.price} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Stock</label>
                            <input name="stock" type="number" value={currentData.stock} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Category</label>
                          <input name="category" value={currentData.category} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Image URL</label>
                          <input name="image_url" value={currentData.image_url} onChange={(e) => handleChange(e, product.id)} className={inputCls} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold text-foreground">{product.name}</h2>
                        {product.description && (
                          <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
                        )}
                        <p className="font-bold mt-2 text-foreground">
                          {formatCurrency(product.price)}{" "}
                          <span className="text-sm font-normal text-muted-foreground">| Stock: {product.stock}</span>
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                          {product.category || "Uncategorized"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 items-center shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(product.id)} className="text-orange-500 hover:text-orange-700" title="Save">
                          <Check size={20} />
                        </button>
                        <button onClick={handleCancelEdit} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" title="Cancel">
                          <X size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditClick(product)} className="text-orange-500 hover:text-orange-700" title="Edit">
                          <Pencil size={20} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700" title="Delete">
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
        <div className="w-full lg:w-96 border border-border rounded-lg shadow-md p-6 bg-card self-start sticky top-24">
          <h2 className="text-xl font-bold mb-4 text-foreground text-center">
            Add New Product
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Name *</label>
              <input name="name" value={newProduct.name} onChange={handleNewChange} placeholder="Product name" className={inputCls} />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Description</label>
              <textarea name="description" value={newProduct.description} onChange={handleNewChange} placeholder="Description" rows={2} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Price (Rs) *</label>
                <input name="price" type="number" min="0" step="0.01" value={newProduct.price} onChange={handleNewChange} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Stock</label>
                <input name="stock" type="number" min="0" value={newProduct.stock} onChange={handleNewChange} placeholder="0" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Category</label>
              <input name="category" value={newProduct.category} onChange={handleNewChange} placeholder="e.g. Bakery" className={inputCls} />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Image URL</label>
              <input name="image_url" value={newProduct.image_url} onChange={handleNewChange} placeholder="https://..." className={inputCls} />
            </div>

            <button
              onClick={handleAddProduct}
              disabled={loading}
              className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add Product"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
