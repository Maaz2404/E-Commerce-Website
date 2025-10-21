"use client";
import { use } from "react";
import ProductView from "@/components/ProductPage";

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // unwrap the params promise
  const { id } = use(params);

  return <ProductView id={id} />;
}
