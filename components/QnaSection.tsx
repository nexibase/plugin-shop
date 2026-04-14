"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  MessageSquare,
  Lock,
  Send,
  Pencil,
  X,
} from "lucide-react"

export interface Qna {
  id: number
  question: string
  answer: string | null
  answeredAt: string | null
  isSecret: boolean
  canView: boolean
  isOwner: boolean
  createdAt: string
  user: { id: number; nickname: string }
}

export interface QnaSectionProps {
  slug: string
  qnas: Qna[]
  qnasLoading: boolean
  qnaTotal: number
  qnaPage: number
  onFetchQnas: (page: number) => void
}

export default function QnaSection({
  slug,
  qnas,
  qnasLoading,
  qnaTotal,
  qnaPage,
  onFetchQnas,
}: QnaSectionProps) {
  const t = useTranslations('shop')
  const [showQnaForm, setShowQnaForm] = useState(false)
  const [qnaContent, setQnaContent] = useState('')
  const [qnaIsSecret, setQnaIsSecret] = useState(false)
  const [submittingQna, setSubmittingQna] = useState(false)

  // 수정 상태
  const [editingQna, setEditingQna] = useState<Qna | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editIsSecret, setEditIsSecret] = useState(false)
  const [submittingEdit, setSubmittingEdit] = useState(false)

  // 삭제 상태
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Q&A 작성
  const submitQna = async () => {
    if (!qnaContent.trim()) return
    setSubmittingQna(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: qnaContent.trim(),
          isSecret: qnaIsSecret
        })
      })
      if (res.ok) {
        setShowQnaForm(false)
        setQnaContent('')
        setQnaIsSecret(false)
        onFetchQnas(1)
      } else {
        const data = await res.json()
        alert(data.error || t('qna.writeFailed'))
      }
    } catch {
      alert(t('qna.writeFailed'))
    } finally {
      setSubmittingQna(false)
    }
  }

  // 수정 시작
  const startEdit = (qna: Qna) => {
    setEditingQna(qna)
    setEditContent(qna.question)
    setEditIsSecret(qna.isSecret)
  }

  // 수정 취소
  const cancelEdit = () => {
    setEditingQna(null)
    setEditContent('')
    setEditIsSecret(false)
  }

  // Q&A 수정
  const submitEdit = async () => {
    if (!editingQna || !editContent.trim()) return
    setSubmittingEdit(true)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qnaId: editingQna.id,
          question: editContent.trim(),
          isSecret: editIsSecret
        })
      })
      if (res.ok) {
        cancelEdit()
        onFetchQnas(qnaPage)
      } else {
        const data = await res.json()
        alert(data.error || t('qna.editFailed'))
      }
    } catch {
      alert(t('qna.editFailed'))
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Q&A 삭제
  const deleteQna = async (qnaId: number) => {
    if (!confirm(t('qna.confirmDelete'))) return
    setDeletingId(qnaId)
    try {
      const res = await fetch(`/api/shop/products/${slug}/qna?id=${qnaId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        onFetchQnas(qnaPage)
      } else {
        const data = await res.json()
        alert(data.error || t('qna.deleteFailed'))
      }
    } catch {
      alert(t('qna.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {/* Q&A 작성 버튼 */}
      {!showQnaForm && (
        <div className="mb-6">
          <Button onClick={() => setShowQnaForm(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('qna.ask')}
          </Button>
        </div>
      )}

      {/* Q&A 작성 폼 */}
      {showQnaForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>{t('qna.contentLabel')}</Label>
              <Textarea
                value={qnaContent}
                onChange={(e) => setQnaContent(e.target.value)}
                placeholder={t('qna.contentPlaceholder')}
                className="mt-1"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="qna-secret"
                checked={qnaIsSecret}
                onCheckedChange={setQnaIsSecret}
              />
              <Label htmlFor="qna-secret" className="flex items-center gap-1 cursor-pointer">
                <Lock className="h-4 w-4" />
                {t('qna.writeSecret')}
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowQnaForm(false)}>
                {t('qna.cancel')}
              </Button>
              <Button
                onClick={submitQna}
                disabled={submittingQna || !qnaContent.trim()}
              >
                {submittingQna ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {t('qna.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Q&A 목록 */}
      {qnasLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : qnas.length > 0 ? (
        <div className="space-y-4">
          {qnas.map(qna => (
            <div key={qna.id} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {qna.isSecret && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        {t('qna.secret')}
                      </Badge>
                    )}
                    <span className="font-medium text-sm">{qna.user.nickname}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(qna.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                    {qna.answer && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        {t('qna.answered')}
                      </Badge>
                    )}
                    {/* 수정/삭제 버튼: 본인 글이고 답변 전에만 표시 */}
                    {qna.isOwner && !qna.answer && !editingQna && (
                      <div className="ml-auto flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(qna)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {t('qna.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-red-500"
                          onClick={() => deleteQna(qna.id)}
                          disabled={deletingId === qna.id}
                        >
                          {deletingId === qna.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <X className="h-3 w-3 mr-1" />
                          )}
                          {t('qna.delete')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 수정 폼 */}
                  {editingQna?.id === qna.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-secret-${qna.id}`}
                          checked={editIsSecret}
                          onCheckedChange={setEditIsSecret}
                        />
                        <Label htmlFor={`edit-secret-${qna.id}`} className="flex items-center gap-1 cursor-pointer text-sm">
                          <Lock className="h-3.5 w-3.5" />
                          {t('qna.secret')}
                        </Label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          {t('qna.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={submitEdit}
                          disabled={submittingEdit || !editContent.trim()}
                        >
                          {submittingEdit && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                          {t('qna.edit')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 질문 */}
                      <div className="mb-3">
                        <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded mr-2 align-top">Q</span>
                        <span className={`text-sm whitespace-pre-wrap ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                          {qna.question}
                        </span>
                      </div>

                      {/* 답변 */}
                      {qna.answer && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded">A</span>
                            {qna.isSecret && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                {t('qna.secretAnswer')}
                              </span>
                            )}
                          </div>
                          <span className={`text-sm whitespace-pre-wrap ${!qna.canView ? 'text-muted-foreground italic' : ''}`}>
                            {qna.answer}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 페이지네이션 */}
          {qnaTotal > 10 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFetchQnas(qnaPage - 1)}
                disabled={qnaPage <= 1}
              >
                {t('prev')}
              </Button>
              <span className="flex items-center px-3 text-sm">
                {qnaPage} / {Math.ceil(qnaTotal / 10)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFetchQnas(qnaPage + 1)}
                disabled={qnaPage >= Math.ceil(qnaTotal / 10)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          {t('qna.noQuestions')}
        </p>
      )}
    </div>
  )
}
