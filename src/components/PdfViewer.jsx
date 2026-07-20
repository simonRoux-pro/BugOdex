import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

const ZOOM_STEP = 0.15
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

export default function PdfViewer({ fileUrl, initialPage, initialZoom, onPageChange, onZoomChange }) {
  const canvasRef = useRef(null)
  const pdfRef = useRef(null)
  const renderTaskRef = useRef(null)

  const [pageNum, setPageNum] = useState(initialPage || 1)
  const [numPages, setNumPages] = useState(null)
  const [zoom, setZoom] = useState(initialZoom || 1)
  const [status, setStatus] = useState('chargement') // chargement | pret | erreur
  const [errorMessage, setErrorMessage] = useState(null)

  // Charge le document PDF
  useEffect(() => {
    let cancelled = false
    setStatus('chargement')
    const loadingTask = pdfjsLib.getDocument(fileUrl)
    loadingTask.promise
      .then((pdf) => {
        if (cancelled) return
        pdfRef.current = pdf
        setNumPages(pdf.numPages)
        setPageNum((p) => Math.min(Math.max(p, 1), pdf.numPages))
        setStatus('pret')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Erreur de chargement du PDF :', err)
        setErrorMessage(err.message)
        setStatus('erreur')
      })
    return () => {
      cancelled = true
      loadingTask.destroy?.()
    }
  }, [fileUrl])

  // Rend la page courante
  useEffect(() => {
    if (status !== 'pret' || !pdfRef.current) return
    let cancelled = false

    pdfRef.current.getPage(pageNum).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width

      renderTaskRef.current?.cancel()
      const task = page.render({ canvasContext: context, viewport })
      renderTaskRef.current = task
      task.promise.catch((err) => {
        if (err?.name !== 'RenderingCancelledException') console.error(err)
      })
    })

    return () => {
      cancelled = true
    }
  }, [pageNum, zoom, status])

  useEffect(() => {
    onPageChange?.(pageNum)
  }, [pageNum]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (n) => {
    if (!numPages) return
    setPageNum(Math.min(Math.max(n, 1), numPages))
  }

  if (status === 'erreur') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink-700 dark:text-ink-300 p-8 text-center">
        <p className="font-serif text-lg">Impossible d'afficher ce document.</p>
        <p className="text-sm text-ink-500 dark:text-ink-400">{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 dark:text-ink-50 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(pageNum - 1)}
            disabled={pageNum <= 1}
            className="px-2 py-1 border border-ink-300 dark:border-ink-600 rounded disabled:opacity-30"
          >
            ← Précédent
          </button>
          <span className="text-sm">
            Page{' '}
            <input
              type="number"
              value={pageNum}
              onChange={(e) => goTo(Number(e.target.value))}
              className="w-14 border border-ink-300 dark:border-ink-600 dark:bg-ink-900 rounded px-1 text-center"
            />{' '}
            / {numPages ?? '…'}
          </span>
          <button
            onClick={() => goTo(pageNum + 1)}
            disabled={numPages != null && pageNum >= numPages}
            className="px-2 py-1 border border-ink-300 dark:border-ink-600 rounded disabled:opacity-30"
          >
            Suivant →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
            className="px-2 py-1 border border-ink-300 dark:border-ink-600 rounded"
            aria-label="Zoom arrière"
          >
            −
          </button>
          <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
            className="px-2 py-1 border border-ink-300 dark:border-ink-600 rounded"
            aria-label="Zoom avant"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-ink-100 dark:bg-ink-900 flex justify-center py-6">
        {status === 'chargement' && (
          <p className="text-ink-500 dark:text-ink-400 self-start mt-12">Chargement du document…</p>
        )}
        <canvas ref={canvasRef} className="shadow-lg bg-white h-fit" />
      </div>
    </div>
  )
}
