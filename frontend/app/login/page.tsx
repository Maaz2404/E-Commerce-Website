"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Login failed");

      console.log("Logged in:", data);
      localStorage.setItem("token", data.token);
      window.dispatchEvent(new Event("authChange"));
      router.push("/");
    } catch (err: any) {
      console.error("Error:", err.message);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#071120_0%,#050b16_55%,#02040a_100%)] px-5 py-24">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,19,38,0.94),rgba(4,8,16,0.98))] p-8 shadow-[0_25px_80px_rgba(2,6,23,0.45)]">
        <h2 className="mb-2 text-center text-3xl font-semibold text-white">
          Log In
        </h2>
        <p className="mb-6 text-center text-sm text-slate-300">
          Welcome back to the refreshed storefront.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter password"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(37,99,235,0.35)] hover:bg-accent"
            >
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
