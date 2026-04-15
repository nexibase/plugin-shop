"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Lock,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react"

interface Qna {
  id: number
  question: string
  answer: string | null
  answeredAt: string | null
  isSecret: boolean
  createdAt: string
  product: { id: number; name: string; slug: string }
  user: { id: number; nickname: string; email: string }
}

interface Stats {
  all: number
  unanswered: number
  answered: number
}

export default function AdminQnaPage() {
  const t = useTranslations('shop.admin')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [qnas, setQnas] = useState<Qna[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const [searchInput, setSearchInput] = useState(search)

  // Reply modal
  const [answerModal, setAnswerModal] = useState<Qna | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchQnas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '20')
      if (status) params.set('status', status)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/shop/qna?${params}`)
      if (res.ok) {
        const data = await res.json()
        setQnas(data.qnas)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('failed to load Q&A:', error)
    } finally {
      setLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    fetchQnas()
  }, [fetchQnas])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (searchInput) params.set('search', searchInput)
    router.push(`/admin/shop/qna?${params}`)
  }

  const handleStatusFilter = (newStatus: string) => {
    const params = new URLSearchParams()
    if (newStatus) params.set('status', newStatus)
    if (search) params.set('search', search)
    router.push(`/admin/shop/qna?${params}`)
  }

  const openAnswerModal = (qna: Qna) => {
    setAnswerModal(qna)
    setAnswerText(qna.answer || '')
  }

  const submitAnswer = async () => {
    if (!answerModal || !answerText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/shop/qna/${answerModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText.trim() })
      })
      if (res.ok) {
        setAnswerModal(null)
        setAnswerText('')
        fetchQnas()
      } else {
        const data = await res.json()
        alert(data.error || t('replyFailed'))
      }
    } catch {
      alert(t('replyFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const deleteQna = async (id: number) => {
    if (!confirm(t('deleteQnaConfirm'))) return
    try {
      const res = await fetch(`/api/admin/shop/qna/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchQnas()
      }
    } catch {
      alert(t('deleteFailedGeneric'))
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              {t('qnaTitle')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('qnaSubtitle')}
            </p>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card
                className={`cursor-pointer transition-colors ${!status ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleStatusFilter('')}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.all}</div>
                  <div className="text-sm text-muted-foreground">{t('total')}</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${status === 'unanswered' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleStatusFilter('unanswered')}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.unanswered}</div>
                  <div className="text-sm text-muted-foreground">{t('unanswered')}</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${status === 'answered' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleStatusFilter('answered')}
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.answered}</div>
                  <div className="text-sm text-muted-foreground">{t('answered')}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('qnaSearchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch}>{t('search')}</Button>
          </div>

          {/* Q&A list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qnas.length > 0 ? (
            <div className="space-y-4">
              {qnas.map(qna => (
                <Card key={qna.id} className={!qna.answer ? 'border-orange-300' : ''}>
                  <CardContent className="p-4">
                    {/* Top info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/shop/products/${qna.product.slug}?tab=qna`}
                          target="_blank"
                          className="text-sm font-medium hover:underline flex items-center gap-1"
                        >
                          {qna.product.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {qna.isSecret && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            {t('secret')}
                          </Badge>
                        )}
                        {qna.answer ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            {t('answered')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                            {t('unanswered')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => deleteQna(qna.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Author info */}
                    <div className="text-xs text-muted-foreground mb-2">
                      {qna.user.nickname} ({qna.user.email}) · {new Date(qna.createdAt).toLocaleString('ko-KR')}
                    </div>

                    {/* Question */}
                    <div className="mb-3">
                      <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mr-2 align-top">Q</span>
                      <span className="text-sm whitespace-pre-wrap">{qna.question}</span>
                    </div>

                    {/* Reply */}
                    {qna.answer ? (
                      <div className="p-3 bg-muted rounded-lg mb-3">
                        <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded mr-2 align-top">A</span>
                        <span className="text-sm whitespace-pre-wrap">{qna.answer}</span>
                        <div className="text-xs text-muted-foreground mt-2">
                          {qna.answeredAt && new Date(qna.answeredAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    ) : null}

                    {/* Reply button */}
                    <Button
                      variant={qna.answer ? "outline" : "default"}
                      size="sm"
                      onClick={() => openAnswerModal(qna)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {qna.answer ? t('replyEdit') : t('replyCreate')}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-4">
                    {t('pageXofY', { page, total: totalPages, count: total })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('noQna')}
            </div>
          )}
        </div>
      </main>

      {/* Reply modal */}
      {answerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAnswerModal(null)}
          />
          <div className="relative bg-background rounded-lg shadow-lg max-w-lg w-full mx-4 p-6">
            <button
              onClick={() => setAnswerModal(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">{t('qnaReply')}</h3>

            {/* 질문 표시 */}
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">
                {answerModal.product.name}
              </div>
              <div className="text-sm">
                <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mr-2 align-top">Q</span>
                <span className="whitespace-pre-wrap">{answerModal.question}</span>
              </div>
            </div>

            {/* Reply input */}
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={t('qnaReplyPlaceholder')}
              rows={5}
              className="mb-4"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAnswerModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={submitAnswer}
                disabled={submitting || !answerText.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {answerModal.answer ? t('edit') : t('register')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
