/**
 * Mobile-safe print & download helpers for Black Fox Factory Management System.
 * Ensures all PDFs have the proper .pdf extension and allows direct native browser printing.
 */

export const printViaPopup = (html) => {
  const win = globalThis.window.open('', '_blank');
  if (!win) return false;
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.warn('Popup print error:', e);
      }
    }, 350);
    return true;
  } catch (e) {
    console.warn('printViaPopup failed:', e);
    try { win.close(); } catch (_) {}
    return false;
  }
};

export const printHtmlDocument = (html, { title = 'print-document' } = {}) => {
  if (!globalThis.window || !globalThis.document?.body) return false;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    width: '1280px',
    height: '900px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    return printViaPopup(html);
  }

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120000);

  try {
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
        printViaPopup(html);
      }
    };

    if (doc.readyState === 'complete') {
      setTimeout(triggerPrint, 300);
    } else {
      win.addEventListener('load', () => setTimeout(triggerPrint, 300), { once: true });
    }
    return true;
  } catch (err) {
    console.warn('iframe printHtmlDocument failed, falling back to popup:', err);
    cleanup();
    return printViaPopup(html);
  }
};

/**
 * Robust PDF download that guarantees the .pdf extension and proper MIME type.
 * Eliminates extensionless UUID downloads in Chrome.
 */
export const downloadPdfBlob = (doc, filename) => {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // 1. Native jsPDF save() — primary and most reliable on desktop Chrome/Edge/Firefox
  try {
    if (typeof doc.save === 'function') {
      doc.save(safeName);
      return;
    }
  } catch (err) {
    console.warn('doc.save() failed, attempting typed blob download:', err);
  }

  // 2. Explicit application/pdf Blob fallback
  try {
    const rawBlob = doc.output('blob');
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  } catch (err2) {
    console.error('downloadPdfBlob fallback failed:', err2);
  }
};

/**
 * Open PDF directly in a new tab or browser viewer for instant printing (Ctrl+P / Print Dialog).
 */
export const printPdfBlob = (doc, title = 'Black Fox PDF Report') => {
  try {
    const rawBlob = doc.output('blob');
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);

    // Open in a new tab where Chrome's built-in PDF viewer renders it with print & download buttons
    const printWin = globalThis.window.open(url, '_blank');
    if (printWin) {
      printWin.focus();
      return true;
    }

    // Fallback if popups are blocked: hidden iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', title);
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print error:', e);
      }
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };
    return true;
  } catch (err) {
    console.error('printPdfBlob failed:', err);
    // Ultimate fallback: download it
    downloadPdfBlob(doc, title);
    return false;
  }
};
