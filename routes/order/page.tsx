"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import Script from "next/script"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  ChevronLeft,
  Package,
  CreditCard,
  Truck,
  AlertCircle,
  Check,
  Pencil,
  Trash2,
  Star,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface OrderItem {
  productId: number
  productName: string
  productSlug: string
  productImage: string | null
  optionId: number | null
  optionText: string
  price: number
  quantity: number
}

interface ShopSettings {
  shop_name: string
  shop_tel: string
  bank_info: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string
  exchange_info: string
  return_info: string
  return_address: string
}

interface UserAddress {
  id: number
  name: string
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  isDefault: boolean
}


export default function OrderPage() {
  const t = useTranslations('shop')
  const locale = useLocale()
  const isKorean = locale === 'ko'
  const router = useRouter()
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 쇼핑몰 설정
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)

  // 배송비
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryInfo, setDeliveryInfo] = useState("")
  const [calculatingDelivery, setCalculatingDelivery] = useState(false)

  // 주문자 정보
  const [ordererName, setOrdererName] = useState("")
  const [ordererPhone, setOrdererPhone] = useState("")
  const [ordererEmail, setOrdererEmail] = useState("")

  // 배송지 정보
  const [sameAsOrderer, setSameAsOrderer] = useState(true)
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [address, setAddress] = useState("")
  const [addressDetail, setAddressDetail] = useState("")
  const [deliveryMemoOption, setDeliveryMemoOption] = useState("none") // 선택 옵션
  const [deliveryMemoCustom, setDeliveryMemoCustom] = useState("") // 직접 입력 텍스트

  // 결제 방법
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [availableMethods, setAvailableMethods] = useState<
    { method: string; adapterId: string; displayName: string }[]
  >([])

  // 주소록 관련 상태
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [skipSaveAddress, setSkipSaveAddress] = useState(false) // 기본값: 저장함 (false = 저장, true = 저장안함)
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null) // 선택된 주소 ID
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null) // 수정 중인 주소
  const [addressEditModalOpen, setAddressEditModalOpen] = useState(false) // 주소 수정 모달
  const [addressForm, setAddressForm] = useState({
    name: '',
    recipientName: '',
    recipientPhone: '',
    zipCode: '',
    address: '',
    addressDetail: '',
    isDefault: false,
  })
  const [addressSaving, setAddressSaving] = useState(false)
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null)

  useEffect(() => {
    loadOrderItems()
    loadShopSettings()
    loadUserInfo()
    loadSavedAddresses()
    fetch('/api/shop/payment/methods')
      .then(r => r.json())
      .then(d => {
        setAvailableMethods(d.methods)
        if (d.methods.length > 0) setPaymentMethod(d.methods[0].method)
      })
      .catch(err => console.error('결제 수단 로드 에러:', err))
  }, [])

  // 로그인한 사용자 정보 불러오기 — 비로그인이면 로그인 페이지로 리다이렉트
  const loadUserInfo = async () => {
    try {
      const res = await fetch("/api/me")
      if (!res.ok || res.status === 401) {
        router.replace('/login?redirect=/shop/order')
        return
      }
      const data = await res.json()
      if (!data?.user) {
        router.replace('/login?redirect=/shop/order')
        return
      }
      setOrdererEmail(data.user.email || "")
      // DB에 저장된 name, phone이 있으면 사용, 없으면 닉네임 사용
      setOrdererName(data.user.name || data.user.nickname || "")
      setOrdererPhone(data.user.phone || "")
    } catch (err) {
      console.error("사용자 정보 로드 에러:", err)
      router.replace('/login?redirect=/shop/order')
    }
  }

  // 주문자 정보 저장 (DB에 저장)
  const saveOrdererInfo = async () => {
    try {
      await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ordererName,
          phone: ordererPhone
        })
      })
    } catch (err) {
      console.error("주문자 정보 저장 에러:", err)
    }
  }

  // 저장된 주소록 불러오기
  const loadSavedAddresses = async () => {
    try {
      const res = await fetch("/api/shop/addresses")
      if (res.ok) {
        const data = await res.json()
        setSavedAddresses(data.addresses)
        // 기본 배송지가 있으면 자동으로 적용
        const defaultAddr = data.addresses.find((a: UserAddress) => a.isDefault)
        if (defaultAddr) {
          setSameAsOrderer(false)
          setRecipientName(defaultAddr.recipientName)
          setRecipientPhone(defaultAddr.recipientPhone)
          setZipCode(defaultAddr.zipCode)
          setAddress(defaultAddr.address)
          setAddressDetail(defaultAddr.addressDetail || "")
          setSelectedAddressId(defaultAddr.id)
          setSkipSaveAddress(true) // 이미 저장된 주소
        }
      }
    } catch (err) {
      console.error("주소록 로드 에러:", err)
    }
  }

  // 주소 적용
  const applyAddress = (addr: UserAddress) => {
    setSameAsOrderer(false)
    setRecipientName(addr.recipientName)
    setRecipientPhone(addr.recipientPhone)
    setZipCode(addr.zipCode)
    setAddress(addr.address)
    setAddressDetail(addr.addressDetail || "")
    setSelectedAddressId(addr.id) // 선택된 주소 ID 저장
    setSkipSaveAddress(true) // 이미 저장된 주소 선택 시 저장 안함
    setAddressModalOpen(false)
  }

  // 새 배송지 입력 모드
  const clearAddressForNewInput = () => {
    setSameAsOrderer(false)
    setRecipientName("")
    setRecipientPhone("")
    setZipCode("")
    setAddress("")
    setAddressDetail("")
    setSelectedAddressId(null)
    setSkipSaveAddress(false) // 새 주소 입력 시 기본값: 저장함
  }

  // 주소 수정 모달 열기
  const openAddressEditModal = (addr: UserAddress) => {
    setEditingAddress(addr)
    setAddressForm({
      name: addr.name,
      recipientName: addr.recipientName,
      recipientPhone: addr.recipientPhone,
      zipCode: addr.zipCode,
      address: addr.address,
      addressDetail: addr.addressDetail || '',
      isDefault: addr.isDefault,
    })
    setAddressEditModalOpen(true)
  }

  // 주소 저장 (수정)
  const saveAddress = async () => {
    if (!editingAddress) return
    if (!addressForm.name || !addressForm.recipientName || !addressForm.recipientPhone ||
        !addressForm.zipCode || !addressForm.address) {
      alert(t('address.enterRequired'))
      return
    }

    setAddressSaving(true)
    try {
      const res = await fetch(`/api/shop/addresses/${editingAddress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      })

      if (res.ok) {
        setAddressEditModalOpen(false)
        loadSavedAddresses()
        // 현재 선택된 주소가 수정된 주소면 폼에도 반영
        if (selectedAddressId === editingAddress.id) {
          setRecipientName(addressForm.recipientName)
          setRecipientPhone(addressForm.recipientPhone)
          setZipCode(addressForm.zipCode)
          setAddress(addressForm.address)
          setAddressDetail(addressForm.addressDetail)
        }
      } else {
        const data = await res.json()
        alert(data.error || t('address.saveFailed'))
      }
    } catch (error) {
      console.error('failed to save address:', error)
      alert(t('address.saveError'))
    } finally {
      setAddressSaving(false)
    }
  }

  // Delete address
  const deleteAddress = async (id: number) => {
    if (!confirm(t('address.deleteConfirm'))) return

    setDeletingAddressId(id)
    try {
      const res = await fetch(`/api/shop/addresses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadSavedAddresses()
        // 현재 선택된 주소가 삭제되면 선택 해제
        if (selectedAddressId === id) {
          setSelectedAddressId(null)
          clearAddressForNewInput()
        }
      } else {
        const data = await res.json()
        alert(data.error || t('address.deleteFailed'))
      }
    } catch (error) {
      console.error('failed to delete address:', error)
    } finally {
      setDeletingAddressId(null)
    }
  }

  // 다음 주소 검색 API (주소 수정 모달용)
  const searchAddressForForm = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof window !== "undefined" && win.daum?.Postcode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new win.daum.Postcode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oncomplete: (data: any) => {
          setAddressForm(prev => ({
            ...prev,
            zipCode: data.zonecode,
            address: data.roadAddress || data.jibunAddress,
          }))
        },
      }).open()
    } else {
      const script = document.createElement("script")
      script.src = "//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win2 = window as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new win2.daum.Postcode({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oncomplete: (data: any) => {
            setAddressForm(prev => ({
              ...prev,
              zipCode: data.zonecode,
              address: data.roadAddress || data.jibunAddress,
            }))
          },
        }).open()
      }
      document.head.appendChild(script)
    }
  }

  // 주문자 정보와 배송지 동기화
  useEffect(() => {
    if (sameAsOrderer) {
      setRecipientName(ordererName)
      setRecipientPhone(ordererPhone)
    }
  }, [sameAsOrderer, ordererName, ordererPhone])

  // 우편번호 변경 시 배송비 계산 (한국 주소에 한함)
  useEffect(() => {
    if (isKorean && zipCode.length === 5) {
      calculateDeliveryFee(zipCode)
    }
  }, [zipCode, orderItems, isKorean])

  // 이니시스 iframe 스타일 강제 수정 (흰색 배경 문제 해결)
  useEffect(() => {
    // 이니시스 요소인지 확인
    const isInicisElement = (el: HTMLElement) =>
      el.id?.includes('INI') || el.className?.includes('INI') || el.className?.includes('inipay')

    const isInicisIframe = (iframe: HTMLIFrameElement) =>
      iframe.src?.includes('inicis') || iframe.name?.includes('INI') || isInicisElement(iframe)

    // iframe 투명화
    const makeIframeTransparent = (iframe: HTMLIFrameElement) => {
      iframe.style.backgroundColor = 'transparent'
      iframe.setAttribute('allowTransparency', 'true')
      iframe.setAttribute('frameBorder', '0')
    }

    // 모든 이니시스 요소 투명화
    const applyTransparency = () => {
      document.querySelectorAll('iframe').forEach(iframe => {
        if (isInicisIframe(iframe)) makeIframeTransparent(iframe)
      })
      document.querySelectorAll<HTMLElement>('#inicisModalDiv, .inipay_modal, .inipay_modal-body, .inipay_modal-content').forEach(el => {
        el.style.cssText = 'background-color: transparent !important; border: none !important; box-shadow: none !important;'
      })
    }

    // MutationObserver로 새로 추가되는 요소 감지
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.tagName === 'IFRAME' && isInicisIframe(node as HTMLIFrameElement)) {
            makeIframeTransparent(node as HTMLIFrameElement)
          }
          if (node.tagName === 'DIV' && isInicisElement(node)) {
            node.style.backgroundColor = 'transparent'
          }
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // 폴백: 주기적으로 체크 (Observer가 놓칠 경우 대비)
    const intervalId = setInterval(applyTransparency, 1000)

    return () => {
      observer.disconnect()
      clearInterval(intervalId)
    }
  }, [])

  const loadOrderItems = () => {
    const items: OrderItem[] = JSON.parse(localStorage.getItem("orderItems") || "[]")
    if (items.length === 0) {
      router.push("/shop/cart")
      return
    }
    setOrderItems(items)
    setLoading(false)
  }

  const loadShopSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setShopSettings(data.settings)
      }
    } catch (err) {
      console.error("failed to load settings:", err)
    }
  }

  const calculateDeliveryFee = async (zip: string) => {
    setCalculatingDelivery(true)
    try {
      const totalPrice = getTotalPrice()
      const res = await fetch("/api/shop/delivery-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: zip, totalPrice }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeliveryFee(data.fee)
        setDeliveryInfo(data.policyName)
      }
    } catch (err) {
      console.error("배송비 계산 에러:", err)
    } finally {
      setCalculatingDelivery(false)
    }
  }

  const getTotalPrice = () => {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const getFinalPrice = () => {
    return getTotalPrice() + deliveryFee
  }

  // 배송 메모 값 가져오기
  const getDeliveryMemo = () => {
    if (deliveryMemoOption === "none") return null
    if (deliveryMemoOption === "custom") return deliveryMemoCustom || null
    return deliveryMemoOption
  }

  const formatPrice = (price: number) => t('policy.won', { amount: price.toLocaleString() })

  // 숨김 폼을 생성해 PG 결제를 트리거하는 헬퍼
  async function submitHiddenForm(action: string, fields: Record<string, string>) {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = action
    form.id = 'pgPayForm'
    form.acceptCharset = 'UTF-8'
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'; input.name = name; input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)

    // Inicis: wait for INIStdPay.js to be ready before calling .pay().
    // The <Script strategy="afterInteractive"> in this page loads it asynchronously.
    if (fields.mid && fields.payUrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      // Poll up to 10s for INIStdPay global; raises setSubmitting on failure.
      const deadline = Date.now() + 10000
      while (!win.INIStdPay && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100))
      }
      if (!win.INIStdPay) {
        setError(t('checkout.paymentModuleError'))
        setSubmitting(false)
        return
      }
      win.INIStdPay.pay('pgPayForm')
      return
    }

    // Non-Inicis PG: plain form POST to provided action URL
    if (action) {
      form.submit()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!ordererName || !ordererPhone) {
      setError(t('checkout.enterBuyerInfo'))
      return
    }

    if (!recipientName || !recipientPhone || !zipCode || !address) {
      setError(t('checkout.enterShippingInfo'))
      return
    }

    setSubmitting(true)

    // 주문자 정보 DB에 저장 (다음 주문 시 자동 입력)
    await saveOrdererInfo()

    try {
      // 자동 저장 조건:
      //  - 기존 저장 주소에서 한 필드라도 수정됐다면 무조건 저장 (skipSaveAddress 무시 — 이 플래그는 저장주소 로드 시 자동 설정되어 재저장을 막는 용도일 뿐)
      //  - 완전히 새 주소 입력이면 "저장 안함" 체크박스를 존중
      const selectedSaved = selectedAddressId
        ? savedAddresses.find(a => a.id === selectedAddressId)
        : null
      const formDiffersFromSelected = !!selectedSaved && (
        selectedSaved.recipientName !== recipientName ||
        selectedSaved.recipientPhone !== recipientPhone ||
        selectedSaved.zipCode !== zipCode ||
        selectedSaved.address !== address ||
        (selectedSaved.addressDetail || "") !== (addressDetail || "")
      )
      const shouldSaveAddress = formDiffersFromSelected || (!skipSaveAddress && !selectedAddressId)
      if (shouldSaveAddress) {
        try {
          await fetch("/api/shop/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientName,
              recipientPhone,
              zipCode,
              address,
              addressDetail: addressDetail || null,
              skipDuplicate: true, // 중복 시 에러 없이 무시
            }),
          })
        } catch (err) {
          console.error("주소 자동 저장 에러:", err)
          // 주소 저장 실패해도 주문은 계속 진행
        }
      }

      const res = await fetch('/api/shop/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems.map(i => ({ productId: i.productId, optionId: i.optionId, quantity: i.quantity })),
          buyer: { name: ordererName, phone: ordererPhone, email: ordererEmail || undefined },
          shipping: {
            recipientName,
            recipientPhone,
            zipCode,
            address,
            addressDetail: addressDetail || undefined,
            deliveryMemo: getDeliveryMemo(),
          },
          method: paymentMethod,
        }),
      })

      const initData = await res.json()

      if (!res.ok) {
        setError(initData.error || t('checkout.paymentPrepareError'))
        setSubmitting(false)
        return
      }

      const { orderNo, prepare } = initData

      if (prepare.kind === 'manual') {
        // 무통장입금 — 장바구니 정리 후 완료 페이지(pending)로 이동
        const cart: OrderItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
        const orderedKeys = new Set(
          orderItems.map(item => `${item.productId}-${item.optionId || "none"}`)
        )
        const newCart = cart.filter(
          item => !orderedKeys.has(`${item.productId}-${item.optionId || "none"}`)
        )
        localStorage.setItem("cart", JSON.stringify(newCart))
        localStorage.removeItem("orderItems")
        window.dispatchEvent(new Event("cartUpdated"))
        router.push(`/shop/order/complete?orderNo=${orderNo}&pending=1`)
      } else if (prepare.kind === 'form') {
        // PG 폼 결제 (이니시스 등) — 장바구니는 결제 완료 콜백에서 정리
        await submitHiddenForm(prepare.formAction ?? '', prepare.formFields!)
      } else if (prepare.kind === 'redirect') {
        window.location.href = prepare.redirectUrl!
      }
    } catch (err) {
      setError(t('checkout.orderProcessError'))
      setSubmitting(false)
    }
  }

  // 전화번호 자동 포맷팅
  const formatPhoneNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '')

    // 1588, 1577 등 대표번호 (4자리-4자리)
    if (/^(15|16|17|18)/.test(numbers)) {
      if (numbers.length <= 4) return numbers
      return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}`
    }

    // 02 서울 지역번호 (02-xxxx-xxxx)
    if (numbers.startsWith('02')) {
      if (numbers.length <= 2) return numbers
      if (numbers.length <= 6) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`
      if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`
    }

    // 휴대폰 및 기타 지역번호 (0xx-xxxx-xxxx)
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  // 다음 주소 검색 API
  const searchAddress = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (typeof window !== "undefined" && win.daum?.Postcode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new win.daum.Postcode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oncomplete: (data: any) => {
          setZipCode(data.zonecode)
          setAddress(data.roadAddress || data.jibunAddress)
        },
      }).open()
    } else {
      // 다음 주소 API 스크립트 로드
      const script = document.createElement("script")
      script.src = "//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win2 = window as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new win2.daum.Postcode({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oncomplete: (data: any) => {
            setZipCode(data.zonecode)
            setAddress(data.roadAddress || data.jibunAddress)
          },
        }).open()
      }
      document.head.appendChild(script)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('goBack')}
            </Button>
            <h1 className="text-2xl font-bold mt-2">{t('checkout.formTitle')}</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Order items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {t('checkout.orderItems')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div
                        key={`${item.productId}-${item.optionId || index}`}
                        className="flex gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                          {item.optionText && (
                            <p className="text-sm text-muted-foreground">{item.optionText}</p>
                          )}
                          <p className="text-sm">
                            {formatPrice(item.price)} × {t('order.itemCountShort', { count: item.quantity })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Customer info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('checkout.buyer')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ordererName">{t('checkout.nameRequired')}</Label>
                        <Input
                          id="ordererName"
                          value={ordererName}
                          onChange={(e) => setOrdererName(e.target.value)}
                          placeholder={t('checkout.buyerNamePlaceholder')}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="ordererPhone">{t('checkout.phoneRequired')}</Label>
                        <Input
                          id="ordererPhone"
                          value={ordererPhone}
                          onChange={(e) => setOrdererPhone(formatPhoneNumber(e.target.value))}
                          placeholder="010-0000-0000"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ordererEmail">{t('checkout.email')}</Label>
                      <Input
                        id="ordererEmail"
                        type="email"
                        value={ordererEmail}
                        onChange={(e) => setOrdererEmail(e.target.value)}
                        placeholder="example@email.com"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      {t('checkout.shipping')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 저장된 배송지 칩 선택 */}
                    {savedAddresses.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {savedAddresses.slice(0, 3).map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => applyAddress(addr)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                              selectedAddressId === addr.id
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-muted/50 hover:border-primary hover:bg-muted'
                            }`}
                          >
                            <span className="font-medium">{addr.name}</span>
                            <span className="text-xs opacity-75">({addr.recipientName})</span>
                          </button>
                        ))}
                        {savedAddresses.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setAddressModalOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-border hover:border-primary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {t('checkout.moreAddresses', { count: savedAddresses.length - 3 })}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={clearAddressForNewInput}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            !selectedAddressId && zipCode
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-dashed border-border hover:border-primary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t('checkout.newAddress')}
                        </button>
                      </div>
                    )}

                    {/* 주문자 정보와 동일 체크박스 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="sameAsOrderer"
                        checked={sameAsOrderer}
                        onChange={(e) => {
                          setSameAsOrderer(e.target.checked)
                          if (e.target.checked) {
                            setSelectedAddressId(null) // 주문자 정보와 동일 선택 시 저장된 주소 선택 해제
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor="sameAsOrderer" className="text-sm cursor-pointer">
                        {t('checkout.sameAsBuyer')}
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recipientName">{t('checkout.recipientName')}</Label>
                        <Input
                          id="recipientName"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder={t('checkout.recipientNamePlaceholder')}
                          required
                          disabled={sameAsOrderer}
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipientPhone">{t('checkout.recipientPhone')}</Label>
                        <Input
                          id="recipientPhone"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))}
                          placeholder="010-0000-0000"
                          required
                          disabled={sameAsOrderer}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>{t('checkout.addressRequiredLabel')}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder={t('checkout.zipcode')}
                          className="w-32"
                          required
                          readOnly={isKorean}
                        />
                        {isKorean && (
                          <Button type="button" variant="outline" onClick={searchAddress}>
                            {t('checkout.addressSearch')}
                          </Button>
                        )}
                      </div>
                    </div>

                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('checkout.addressMain')}
                      required
                      readOnly={isKorean}
                    />

                    <Input
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      placeholder={t('checkout.addressDetail')}
                    />

                    <div>
                      <Label htmlFor="deliveryMemo">{t('checkout.memo')}</Label>
                      <Select value={deliveryMemoOption} onValueChange={setDeliveryMemoOption}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('checkout.memoSelectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('checkout.memoNone')}</SelectItem>
                          <SelectItem value={t('deliveryMemo.doorFront')}>
                            {t('deliveryMemo.doorFront')}
                          </SelectItem>
                          <SelectItem value={t('deliveryMemo.securityDesk')}>
                            {t('deliveryMemo.securityDesk')}
                          </SelectItem>
                          <SelectItem value={t('deliveryMemo.callFirst')}>
                            {t('deliveryMemo.callFirst')}
                          </SelectItem>
                          <SelectItem value="custom">{t('checkout.directInput')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {deliveryMemoOption === "custom" && (
                        <Input
                          className="mt-2"
                          placeholder={t('checkout.memoInputPlaceholder')}
                          value={deliveryMemoCustom}
                          onChange={(e) => setDeliveryMemoCustom(e.target.value)}
                        />
                      )}
                    </div>

                    {deliveryInfo && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-500" />
                        {t('checkout.shippingFeeInfo', { info: deliveryInfo, price: formatPrice(deliveryFee) })}
                      </div>
                    )}

                    {/* 주소 저장 안함 체크박스 (새 주소 입력 시만 표시) */}
                    {zipCode && address && !selectedAddressId && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="skipSaveAddress"
                            checked={skipSaveAddress}
                            onChange={(e) => setSkipSaveAddress(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="skipSaveAddress" className="text-sm cursor-pointer text-muted-foreground">
                            {t('checkout.doNotSaveAddress')}
                          </label>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 결제 방법 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {t('checkout.payment')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {availableMethods.map(m => (
                        <button
                          key={`${m.adapterId}:${m.method}`}
                          type="button"
                          onClick={() => setPaymentMethod(m.method)}
                          className={`w-full p-4 border rounded-lg text-left transition-colors ${
                            paymentMethod === m.method
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <p className="font-medium">
                            {t(`checkout.methods.${m.method}`, { default: m.displayName } as Parameters<typeof t>[1])}
                          </p>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'bank_deposit' && shopSettings?.bank_info && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">{t('checkout.bankTransferInfo')}</p>
                        <p className="text-sm whitespace-pre-wrap">
                          {shopSettings.bank_info}
                        </p>
                      </div>
                    )}

                    {paymentMethod && paymentMethod !== 'bank_deposit' && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {t('checkout.cardRedirectInfo')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 배송/환불/반품교환 정책 */}
                {shopSettings && (shopSettings.delivery_notice || shopSettings.refund_policy || shopSettings.exchange_info || shopSettings.return_info) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        {t('checkout.orderNotice')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {shopSettings.delivery_notice && (
                        <div>
                          <h4 className="font-medium mb-1 flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            {t('checkout.shippingInfo')}
                          </h4>
                          <p className="text-muted-foreground whitespace-pre-wrap pl-6">
                            {shopSettings.delivery_notice}
                          </p>
                        </div>
                      )}
                      {shopSettings.refund_policy && (
                        <div>
                          <h4 className="font-medium mb-1">{t('checkout.refundPolicy')}</h4>
                          <p className="text-muted-foreground whitespace-pre-wrap pl-6">
                            {shopSettings.refund_policy}
                          </p>
                          {shopSettings.return_shipping_fee && (
                            <p className="text-muted-foreground pl-6 mt-1">
                              {t('checkout.returnShippingDeduction', { fee: parseInt(shopSettings.return_shipping_fee).toLocaleString() })}
                            </p>
                          )}
                        </div>
                      )}
                      {(shopSettings.exchange_info || shopSettings.return_info) && (
                        <div>
                          <h4 className="font-medium mb-1">{t('checkout.exchangeReturnInfo')}</h4>
                          {shopSettings.exchange_info && (
                            <div className="pl-6 mb-2">
                              <p className="text-xs font-medium text-muted-foreground">{t('checkout.exchange')}</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {shopSettings.exchange_info}
                              </p>
                            </div>
                          )}
                          {shopSettings.return_info && (
                            <div className="pl-6 mb-2">
                              <p className="text-xs font-medium text-muted-foreground">{t('checkout.return')}</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">
                                {shopSettings.return_info}
                              </p>
                            </div>
                          )}
                          {shopSettings.return_address && (
                            <div className="pl-6">
                              <p className="text-xs font-medium text-muted-foreground">{t('checkout.returnAddress')}</p>
                              <p className="text-muted-foreground">
                                {shopSettings.return_address}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 결제 요약 */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('checkout.summary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>{t('order.productAmount')}</span>
                      <span>{formatPrice(getTotalPrice())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('order.shippingFee')}</span>
                      <span>
                        {calculatingDelivery ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : zipCode ? (
                          formatPrice(deliveryFee)
                        ) : (
                          t('checkout.enterAddressToCalc')
                        )}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{t('checkout.totalAmount')}</span>
                        <span className="text-xl font-bold text-primary">
                          {formatPrice(getFinalPrice())}
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={submitting || !zipCode}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('checkout.processing')}
                        </>
                      ) : (
                        <>
                          {t('checkout.placeOrderWithAmount', { amount: formatPrice(getFinalPrice()) })}
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      {t('checkout.agree')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>

      {/* 이니시스 스크립트 - afterInteractive (App Router에서 beforeInteractive는 layout 전용) */}
      <Script
        src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        strategy="afterInteractive"
      />

      {/* 배송지 선택 모달 */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('address.selectAddress')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {savedAddresses.map((addr) => (
              <div
                key={addr.id}
                className={`relative p-4 rounded-lg border transition-colors ${
                  selectedAddressId === addr.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                }`}
              >
                {/* 선택 영역 */}
                <button
                  type="button"
                  onClick={() => applyAddress(addr)}
                  className="w-full text-left pr-16"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{addr.name}</span>
                    {addr.isDefault && (
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5" />
                        {t('address.default')}
                      </span>
                    )}
                    {selectedAddressId === addr.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {addr.recipientName} | {addr.recipientPhone}
                  </p>
                  <p className="text-sm">
                    [{addr.zipCode}] {addr.address}
                    {addr.addressDetail && `, ${addr.addressDetail}`}
                  </p>
                </button>

                {/* 수정/삭제 버튼 */}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAddressEditModal(addr)
                    }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title={t('address.edit')}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteAddress(addr.id)
                    }}
                    disabled={deletingAddressId === addr.id}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title={t('address.delete')}
                  >
                    {deletingAddressId === addr.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 배송지 수정 모달 */}
      <Dialog open={addressEditModalOpen} onOpenChange={setAddressEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('address.editAddress')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addressName">{t('address.addressName')}</Label>
              <Input
                id="addressName"
                placeholder={t('address.addressNamePlaceholder')}
                value={addressForm.name}
                onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editRecipientName">{t('address.recipientName')}</Label>
                <Input
                  id="editRecipientName"
                  placeholder={t('address.namePlaceholder')}
                  value={addressForm.recipientName}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editRecipientPhone">{t('address.recipientPhone')}</Label>
                <Input
                  id="editRecipientPhone"
                  placeholder="010-0000-0000"
                  value={addressForm.recipientPhone}
                  onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: formatPhoneNumber(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>{t('address.addressLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  value={addressForm.zipCode}
                  onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })}
                  placeholder={t('address.zipcode')}
                  className="w-28"
                  readOnly={isKorean}
                />
                {isKorean && (
                  <Button type="button" variant="outline" onClick={searchAddressForForm}>
                    {t('address.addressSearch')}
                  </Button>
                )}
              </div>
            </div>
            <Input
              value={addressForm.address}
              onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
              placeholder={t('address.addressMain')}
              readOnly={isKorean}
            />
            <Input
              value={addressForm.addressDetail}
              placeholder={t('address.addressDetail')}
              onChange={(e) => setAddressForm({ ...addressForm, addressDetail: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsDefault"
                checked={addressForm.isDefault}
                onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="editIsDefault" className="text-sm cursor-pointer">
                {t('address.setAsDefault')}
              </label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddressEditModalOpen(false)}
              >
                {t('address.cancel')}
              </Button>
              <Button
                className="flex-1"
                onClick={saveAddress}
                disabled={addressSaving}
              >
                {addressSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('address.update')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  )
}
