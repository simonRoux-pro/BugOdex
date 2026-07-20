export default function LoadingScreen({ message = 'Chargement…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-700 dark:text-ink-300">
      <div className="h-10 w-10 rounded-full border-4 border-ink-200 dark:border-ink-700 border-t-ink-600 dark:border-t-ink-300 animate-spin" />
      <p className="font-serif text-lg">{message}</p>
    </div>
  )
}
