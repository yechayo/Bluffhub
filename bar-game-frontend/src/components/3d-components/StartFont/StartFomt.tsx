import { useEffect, useMemo, useState } from 'react'

type StartFontProps = {
  text?: string
  className?: string
}

export default function StartFont({ text = 'Start Game', className = '' }: StartFontProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const chars = useMemo(() => text.split(''), [text])
  const fontSize = isMobile ? 32 : 56
  const gap = isMobile ? 8 : 14

  return (
    <div
      className={`start-font-container ${className}`.trim()}
      style={{
        width: '100%',
        minHeight: isMobile ? '60vh' : '400px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: `${gap}px`,
        paddingTop: isMobile ? '40vh' : '246px',
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        color: '#f9b700ff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
        letterSpacing: isMobile ? '2px' : '4px',
        userSelect: 'none',
        cursor: 'pointer'
      }}
    >
      {chars.map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="start-font-letter"
          style={{
            display: 'inline-block',
            fontSize: `${fontSize}px`,
            animationDelay: `${index * 0.08}s`,
            marginRight: char === ' ' ? `${gap * 1.5}px` : 0
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}
