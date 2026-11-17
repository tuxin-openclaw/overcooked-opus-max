export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="mini-stars" aria-label={`${n} 星`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''}>
          ★
        </i>
      ))}
    </span>
  )
}
