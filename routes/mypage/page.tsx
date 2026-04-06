"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ShopMyPage() {
	const router = useRouter()
	useEffect(() => {
		router.replace('/shop/mypage/orders')
	}, [router])
	return null
}
