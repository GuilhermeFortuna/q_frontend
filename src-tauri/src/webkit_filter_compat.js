// Native initialization script; runs before the page's application scripts.
;(() => {
  const apply = () => {
    document.documentElement.dataset.webkitFilterCompat = 'true'
  }

  if (document.documentElement) {
    apply()
    return
  }

  const observer = new MutationObserver(() => {
    if (!document.documentElement) return
    apply()
    observer.disconnect()
  })
  observer.observe(document, { childList: true })
})()
