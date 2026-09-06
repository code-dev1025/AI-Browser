import { useId } from 'react'

/**
 * A spark cut out of a squircle whose top-left corner is squared off.
 *
 * At 20px a mark gets about seven perceptual units, so it carries exactly one
 * figure: the cut-out is large enough that its arms stay ~3px and legible.
 * Earlier drafts — stacked planes, a rail slot, a tab silhouette — all had
 * detail under 3px and turned to smudge. The one squared corner is the cheap
 * distinguishing move that survives at this size.
 *
 * Inline SVG, so it takes the theme's accent and stays sharp at any DPI.
 */
export function BrandLogo({
  size = 20,
  wordmark = true
}: {
  size?: number
  wordmark?: boolean
}): React.ReactElement {
  const maskId = useId()

  return (
    <span className="brandlogo">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <mask id={maskId}>
          <path
            d="M5 3H15A6 6 0 0 1 21 9V15A6 6 0 0 1 15 21H9A6 6 0 0 1 3 15V5A2 2 0 0 1 5 3Z"
            fill="#fff"
          />
          <path
            d="M12 5.4 13.84 10.16 18.6 12 13.84 13.84 12 18.6 10.16 13.84 5.4 12 10.16 10.16Z"
            fill="#000"
          />
        </mask>
        <rect x="0" y="0" width="24" height="24" fill="var(--accent)" mask={`url(#${maskId})`} />
      </svg>

      {wordmark && (
        <span className="wordmark">
          <b>AI</b>Browser
        </span>
      )}
    </span>
  )
}
