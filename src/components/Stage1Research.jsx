import { useState } from 'react';
import { callLLM } from '../api/llm.js';
import { RESEARCH_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';
import OutputBox from './OutputBox.jsx';

const WORKER_SRC =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Extracts plain text from a PDF File using pdf.js.
 * Preserves line breaks between text blocks on different vertical positions.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function extractPdfText(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('pdf.js failed to load — please refresh the page.');

  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    const parts = [];

    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        parts.push('\n');
      }
      parts.push(item.str);
      lastY = item.transform[5];
    }

    pageTexts.push(parts.join(''));
  }

  return pageTexts.join('\n\n');
}

export default function Stage1Research({ provider, apiKey, onComplete }) {
  const [title, setTitle] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // PDF reference blog
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [resolvedStyleRef, setResolvedStyleRef] = useState('');

  // Stage status
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');

  const isBusy = extractingPdf || loading;
  // Groq gets text extraction; OpenAI and Anthropic receive the raw PDF base64
  const useTextExtraction = provider === 'groq';

  function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file only.');
      setPdfFile(null);
      setPdfBase64('');
      return;
    }

    setPdfFile(file);
    setPdfError('');
    setResolvedStyleRef('');

    // Pre-compute base64 now so it's ready for OpenAI/Anthropic at write time
    const reader = new FileReader();
    reader.onload = () => setPdfBase64(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  }

  async function handleResearch(e) {
    e.preventDefault();
    setError('');
    setBrief('');

    // For Groq: extract text from PDF now so it goes into the style reference
    if (pdfFile && useTextExtraction) {
      setExtractingPdf(true);
      try {
        const text = await extractPdfText(pdfFile);
        setResolvedStyleRef(text);
      } catch (err) {
        setError(`Could not read PDF: ${err.message}`);
        setExtractingPdf(false);
        return;
      }
      setExtractingPdf(false);
    } else {
      // OpenAI/Anthropic: PDF will be sent as base64 document in Stage 2
      setResolvedStyleRef('');
    }

    setLoading(true);
    const userMessage =
      `Title: ${title} | Primary keyword: ${primaryKeyword} | ` +
      `Secondary keywords: ${secondaryKeywords} | Target audience: ${targetAudience}`;

    try {
      const result = await callLLM(provider, apiKey, RESEARCH_SYSTEM_PROMPT, userMessage);
      setBrief(result);
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleProceed() {
    onComplete({
      title,
      primaryKeyword,
      secondaryKeywords,
      targetAudience,
      styleReference: resolvedStyleRef,
      // pdfBase64 only forwarded for providers that consume it natively
      pdfBase64: useTextExtraction ? '' : pdfBase64,
      brief,
    });
  }

  const canSubmit = title.trim() && primaryKeyword.trim() && targetAudience.trim() && apiKey;

  return (
    <section className="stage-section">
      <h2 className="stage-title">Stage 1: Research</h2>
      <p className="stage-description">
        Enter your blog details. The research agent will build a structured brief.
      </p>

      <form onSubmit={handleResearch} className="stage-form" noValidate>
        <div className="form-group">
          <label htmlFor="blog-title">Blog title <span className="required">*</span></label>
          <input
            id="blog-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How Indian CFOs Are Automating Accounts Payable in 2025"
            required
            disabled={isBusy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="primary-keyword">
            Primary keyword <span className="required">*</span>
          </label>
          <input
            id="primary-keyword"
            type="text"
            value={primaryKeyword}
            onChange={(e) => setPrimaryKeyword(e.target.value)}
            placeholder="e.g. accounts payable automation India"
            required
            disabled={isBusy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="secondary-keywords">Secondary keywords</label>
          <input
            id="secondary-keywords"
            type="text"
            value={secondaryKeywords}
            onChange={(e) => setSecondaryKeywords(e.target.value)}
            placeholder="comma separated, up to 3"
            disabled={isBusy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="target-audience">
            Target audience <span className="required">*</span>
          </label>
          <input
            id="target-audience"
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. CFOs and finance heads at Indian mid-market enterprises"
            required
            disabled={isBusy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ref-pdf">Reference blog for style</label>
          <small className="field-hint">
            Open any blog → Cmd+P (Mac) or Ctrl+P (Windows) → Save as PDF → upload here
          </small>
          <div className="pdf-upload-area">
            <input
              id="ref-pdf"
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              disabled={isBusy}
              className="pdf-file-input"
            />
            <label
              htmlFor="ref-pdf"
              className={`pdf-upload-label ${isBusy ? 'pdf-upload-disabled' : ''}`}
            >
              {pdfFile ? 'Change PDF' : 'Choose PDF'}
            </label>
            {pdfFile && !pdfError && (
              <p className="pdf-loaded">Reference blog loaded: {pdfFile.name}</p>
            )}
            {pdfError && (
              <p className="pdf-error" role="alert">{pdfError}</p>
            )}
          </div>
        </div>

        {!apiKey && (
          <p className="form-warning">Enter your API key at the top to continue.</p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit || isBusy}
        >
          Research
        </button>
      </form>

      {extractingPdf && (
        <div className="fetch-status">
          <Spinner />
          <p className="fetch-status-text">Extracting text from PDF...</p>
        </div>
      )}

      {loading && !extractingPdf && <Spinner />}

      {error && (
        <div className="error-box" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {brief && !isBusy && (
        <div className="output-section">
          <h3 className="output-label">Research Brief</h3>
          <OutputBox content={brief} label="Copy Brief" />
          <div className="action-row">
            <button className="btn btn-primary" onClick={handleProceed}>
              Write Blog With This Research
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
