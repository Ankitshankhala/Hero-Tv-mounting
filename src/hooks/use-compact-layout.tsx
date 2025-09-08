import * as React from "react"

const COMPACT_HEIGHT_BREAKPOINT = 800

export function useCompactLayout() {
  const [isCompact, setIsCompact] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkHeight = () => {
      setIsCompact(window.innerHeight < COMPACT_HEIGHT_BREAKPOINT)
    }
    
    const resizeObserver = new ResizeObserver(checkHeight)
    resizeObserver.observe(document.documentElement)
    checkHeight()
    
    return () => resizeObserver.disconnect()
  }, [])

  return isCompact
}