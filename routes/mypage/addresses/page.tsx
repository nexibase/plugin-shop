"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Loader2,
	MapPin,
	Plus,
	Pencil,
	Trash2,
	Star,
} from "lucide-react"

interface UserAddress {
	id: number
	name: string
	recipientName: string
	recipientPhone: string
	zipCode: string
	address: string
	addressDetail: string | null
	isDefault: boolean
	createdAt: string
}

export default function AddressesPage() {
	const t = useTranslations('shop')
	const router = useRouter()

	const [addresses, setAddresses] = useState<UserAddress[]>([])
	const [addressesLoading, setAddressesLoading] = useState(true)
	const [addressModalOpen, setAddressModalOpen] = useState(false)
	const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null)
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

	const fetchAddresses = useCallback(async () => {
		setAddressesLoading(true)
		try {
			const res = await fetch('/api/shop/addresses')
			if (res.status === 401) {
				router.push('/login?redirect=/shop/mypage/addresses')
				return
			}
			if (res.ok) {
				const data = await res.json()
				setAddresses(data.addresses)
			}
		} catch (error) {
			console.error('주소록 조회 에러:', error)
		} finally {
			setAddressesLoading(false)
		}
	}, [router])

	useEffect(() => {
		fetchAddresses()
	}, [fetchAddresses])

	const openAddressModal = (address?: UserAddress) => {
		if (address) {
			setEditingAddress(address)
			setAddressForm({
				name: address.name,
				recipientName: address.recipientName,
				recipientPhone: address.recipientPhone,
				zipCode: address.zipCode,
				address: address.address,
				addressDetail: address.addressDetail || '',
				isDefault: address.isDefault,
			})
		} else {
			setEditingAddress(null)
			setAddressForm({
				name: '',
				recipientName: '',
				recipientPhone: '',
				zipCode: '',
				address: '',
				addressDetail: '',
				isDefault: false,
			})
		}
		setAddressModalOpen(true)
	}

	const saveAddress = async () => {
		if (!addressForm.name || !addressForm.recipientName || !addressForm.recipientPhone ||
				!addressForm.zipCode || !addressForm.address) {
			alert(t('address.enterRequired'))
			return
		}

		setAddressSaving(true)
		try {
			const url = editingAddress
				? `/api/shop/addresses/${editingAddress.id}`
				: '/api/shop/addresses'
			const method = editingAddress ? 'PUT' : 'POST'

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(addressForm),
			})

			if (res.ok) {
				setAddressModalOpen(false)
				fetchAddresses()
			} else {
				const data = await res.json()
				alert(data.error || t('address.saveFailed'))
			}
		} catch (error) {
			console.error('주소 저장 에러:', error)
			alert(t('address.saveError'))
		} finally {
			setAddressSaving(false)
		}
	}

	const deleteAddress = async (id: number) => {
		if (!confirm(t('address.deleteConfirm'))) return

		setDeletingAddressId(id)
		try {
			const res = await fetch(`/api/shop/addresses/${id}`, { method: 'DELETE' })
			if (res.ok) {
				fetchAddresses()
			} else {
				const data = await res.json()
				alert(data.error || t('address.deleteFailed'))
			}
		} catch (error) {
			console.error('주소 삭제 에러:', error)
		} finally {
			setDeletingAddressId(null)
		}
	}

	const formatPhoneNumber = (value: string): string => {
		const numbers = value.replace(/[^0-9]/g, '')
		if (/^(15|16|17|18)/.test(numbers)) {
			if (numbers.length <= 4) return numbers
			return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}`
		}
		if (numbers.startsWith('02')) {
			if (numbers.length <= 2) return numbers
			if (numbers.length <= 6) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`
			if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`
			return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`
		}
		if (numbers.length <= 3) return numbers
		if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
		if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
		return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
	}

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
			script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
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

	return (
		<MyPageLayout>
			{/* 주소 추가 버튼 */}
			<div className="flex justify-end mb-4">
				<Button onClick={() => openAddressModal()}>
					<Plus className="h-4 w-4 mr-2" />
					{t('address.addNew')}
				</Button>
			</div>

			{addressesLoading ? (
				<div className="flex justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : addresses.length === 0 ? (
				<Card>
					<CardContent className="py-16 text-center">
						<MapPin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
						<p className="text-muted-foreground mb-4">{t('address.noAddresses')}</p>
						<Button onClick={() => openAddressModal()}>
							<Plus className="h-4 w-4 mr-2" />
							{t('address.addShippingAddress')}
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{addresses.map((addr) => (
						<Card key={addr.id} className={addr.isDefault ? 'ring-2 ring-primary' : ''}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-2">
											<h3 className="font-medium">{addr.name}</h3>
											{addr.isDefault && (
												<Badge variant="default" className="text-xs">
													<Star className="h-3 w-3 mr-1" />
													{t('address.defaultAddress')}
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground mb-1">
											{addr.recipientName} | {addr.recipientPhone}
										</p>
										<p className="text-sm">
											[{addr.zipCode}] {addr.address}
											{addr.addressDetail && `, ${addr.addressDetail}`}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => openAddressModal(addr)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => deleteAddress(addr.id)}
											disabled={deletingAddressId === addr.id}
										>
											{deletingAddressId === addr.id ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Trash2 className="h-4 w-4 text-destructive" />
											)}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* 주소 추가/수정 모달 */}
			<Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingAddress ? t('address.editAddress') : t('address.newAddress')}
						</DialogTitle>
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
								<Label htmlFor="recipientName">{t('address.recipientName')}</Label>
								<Input
									id="recipientName"
									placeholder={t('address.namePlaceholder')}
									value={addressForm.recipientName}
									onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
								/>
							</div>
							<div>
								<Label htmlFor="recipientPhone">{t('address.recipientPhone')}</Label>
								<Input
									id="recipientPhone"
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
									placeholder={t('address.zipcode')}
									className="w-28"
									readOnly
								/>
								<Button type="button" variant="outline" onClick={searchAddressForForm}>
									{t('address.addressSearch')}
								</Button>
							</div>
						</div>
						<Input
							value={addressForm.address}
							placeholder={t('address.addressMain')}
							readOnly
						/>
						<Input
							value={addressForm.addressDetail}
							placeholder={t('address.addressDetail')}
							onChange={(e) => setAddressForm({ ...addressForm, addressDetail: e.target.value })}
						/>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="isDefault"
								checked={addressForm.isDefault}
								onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
								className="rounded"
							/>
							<label htmlFor="isDefault" className="text-sm cursor-pointer">
								{t('address.setAsDefault')}
							</label>
						</div>
						<div className="flex gap-2 pt-4">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => setAddressModalOpen(false)}
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
								{editingAddress ? t('address.update') : t('address.add')}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</MyPageLayout>
	)
}
