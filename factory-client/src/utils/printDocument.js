/**
 * Mobile-safe print/download helpers.
 * Phones often block window.open() and choke on remote @font-face imports.
 */

export const printHtmlDocument = (html, { title = 'print-document' } = {}) => {
  if (!globalThis.window || !globalThis.document?.body) return false;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120000);

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };

  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 250);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 250), { once: true });
  }
  return true;
};

/** jsPDF / file download that works more reliably on iOS Safari. */
export const downloadPdfBlob = (doc, filename) => {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = doc.output('blob');

  // iOS Safari: <a download> is unreliable; open blob URL instead.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const url = URL.createObjectURL(blob);
  try {
    if (isIOS) {
      const opened = globalThis.window.open(url, '_blank');
      if (!opened) {
        // Popup blocked — fall back to same-tab navigation.
        globalThis.location.assign(url);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch {
    doc.save(safeName);
    URL.revokeObjectURL(url);
  }
};
