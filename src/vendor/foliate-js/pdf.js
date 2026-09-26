// СТОЛЫПИНЪ: PDFs are rendered by our own pdf.js viewer (src/modules/library/PdfViewer.svelte),
// so the upstream experimental PDF adapter (which needs a vendored pdfjs build) is replaced by this stub.
export const makePDF = async () => {
    throw new Error('PDF is handled by the app PDF viewer')
}
