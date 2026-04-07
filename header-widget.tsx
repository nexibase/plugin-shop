"use client"

import { useState, useEffect } from "react"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ShopHeaderWidget() {
  const [cartCount, setCartCount] = useState(0)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/settings/plugin-status?folder=shop')
      .then(r => r.json())
      .then(d => setEnabled(d.enabled === true))
      .catch(() => setEnabled(false))
  }, [])

  useEffect(() => {
    if (!enabled) return

    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]")
        setCartCount(cart.length)
      } catch {
        setCartCount(0)
      }
    }

    updateCartCount()
    window.addEventListener("cartUpdated", updateCartCount)
    window.addEventListener("storage", updateCartCount)

    return () => {
      window.removeEventListener("cartUpdated", updateCartCount)
      window.removeEventListener("storage", updateCartCount)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <Link href="/shop/cart">
      <Button variant="ghost" size="icon" className="relative">
        <ShoppingCart className="h-5 w-5" />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </Button>
    </Link>
  )
}
