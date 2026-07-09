import { useEffect, useState } from 'react'

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

// Live Europe/London clock.
export default function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="clock tnum" title="Europe/London">
      London {fmt.format(now)}
    </span>
  )
}
