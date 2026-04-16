import { useState } from 'react';
import { callLLM, analyzeImage, PROVIDERS } from '../api/llm.js';
import { htmlToMarkdown } from '../api/htmlToMarkdown.js';
import { RESEARCH_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';
import OutputBox from './OutputBox.jsx';

const VISION_PROMPT =
  "Analyse this blog screenshot's exact structure: count and note every H1, H2, H3 heading, " +
  'bullet point patterns, paragraph lengths, section count, CTA style. Use this as the exact ' +
  'style template to mirror — same number of sections, same heading hierarchy, same bullet usage.';

export default function Stage1Research({ provider, apiKey, onComplete }) {
  const [title, setTitle] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Reference blog
  const [refTab, setRefTab] = useState('url');
  const [refUrl, setRefUrl] = useState('');
  const [refPaste, setRefPaste] = useState('');
  const [refImage, setRefImage] = useState(null); // { base64, mediaType, preview }

  // Status
  const [fetchingRef, setFetchingRef] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [refetchError, setRefetchError] = useState('');
  const [resolvedRef, setResolvedRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');

  const supportsVision = PROVIDERS[provider]?.supportsVision;
  const activeTab = (!supportsVision && refTab === 'screenshot') ? 'url' : refTab;

  const isBusy = fetchingRef || loading;

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setRefImage({
        base64: dataUrl.split(',')[1],
        mediaType: file.type || 'image/jpeg',
        preview: dataUrl,
      });
      setRefetchError('');
    };
    reader.readAsDataURL(file);
  }

  async function resolveStyleReference() {
    if (activeTab === 'url' && refUrl.trim()) {
      setFetchStatus('Fetching reference blog...');
      setFetchingRef(true);
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(refUrl.trim())}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Proxy request failed');
        const json = await res.json();
        if (!json.contents) throw new Error('Empty proxy response');
        const markdown = htmlToMarkdown(json.contents);
        if (!markdown) throw new Error('No readable text found at this URL');
        setFetchingRef(false);
        return markdown;
      } catch {
        setRefetchError('Could not fetch this URL. Please paste the blog text directly instead.');
        setFetchingRef(false);
        return null;
      }
    }

    if (activeTab === 'paste' && refPaste.trim()) {
      return refPaste.trim();
    }

    if (activeTab === 'screenshot' && refImage) {
      setFetchStatus('Analysing screenshot...');
      setFetchingRef(true);
      try {
        const result = await analyzeImage(provider, apiKey, refImage.base64, refImage.mediaType, VISION_PROMPT);
        setFetchingRef(false);
        return result;
      } catch (err) {
        setRefetchError(`Could not analyse screenshot: ${err.message}`);
        setFetchingRef(false);
        return null;
      }
    }

    return '';
  }

  async function handleResearch(e) {
    e.preventDefault();
    setError('');
    setRefetchError('');
    setBrief('');

    const styleRef = await resolveStyleReference();
    if (styleRef === null) return;
    setResolvedRef(styleRef);

    setLoading(true);
    const userMessage = `Title: ${title} | Primary keyword: ${primaryKeyword} | Secondary keywords: ${secondaryKeywords} | Target audience: ${targetAudience}`;

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
    onComplete({ title, primaryKeyword, secondaryKeywords, targetAudience, styleReference: resolvedRef, brief });
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

        {/* Reference blog */}
        <div className="form-group">
          <label>Reference blog for style</label>
          <small className="field-hint">
            Agent will match its length, structure, and tone. Provide one of the options below.
          </small>

          <div className="ref-tabs">
            <button
              type="button"
              className={`ref-tab ${activeTab === 'url' ? 'ref-tab-active' : ''}`}
              onClick={() => { setRefTab('url'); setRefetchError(''); }}
              disabled={isBusy}
            >
              URL
            </button>
            <button
              type="button"
              className={`ref-tab ${activeTab === 'paste' ? 'ref-tab-active' : ''}`}
              onClick={() => { setRefTab('paste'); setRefetchError(''); }}
              disabled={isBusy}
            >
              Paste text
            </button>
            {supportsVision && (
              <button
                type="button"
                className={`ref-tab ${activeTab === 'screenshot' ? 'ref-tab-active' : ''}`}
                onClick={() => { setRefTab('screenshot'); setRefetchError(''); }}
                disabled={isBusy}
              >
                Upload screenshot
              </button>
            )}
          </div>

          <div className="ref-tab-content">
            {activeTab === 'url' && (
              <input
                type="url"
                value={refUrl}
                onChange={(e) => { setRefUrl(e.target.value); setRefetchError(''); }}
                placeholder="https://example.com/blog-post"
                disabled={isBusy}
              />
            )}

            {activeTab === 'paste' && (
              <textarea
                value={refPaste}
                onChange={(e) => setRefPaste(e.target.value)}
                placeholder="Paste reference blog text here..."
                rows={8}
                disabled={isBusy}
              />
            )}

            {activeTab === 'screenshot' && (
              <div className="ref-upload-area">
                <input
                  id="ref-screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isBusy}
                  className="ref-file-input"
                />
                <label htmlFor="ref-screenshot" className={`ref-upload-label ${isBusy ? 'ref-upload-disabled' : ''}`}>
                  {refImage ? 'Change image' : 'Choose screenshot'}
                </label>
                {refImage && (
                  <img
                    src={refImage.preview}
                    alt="Reference blog screenshot preview"
                    className="ref-image-preview"
                  />
                )}
              </div>
            )}

            {refetchError && (
              <p className="ref-fetch-error" role="alert">{refetchError}</p>
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

      {fetchingRef && (
        <div className="fetch-status">
          <Spinner />
          <p className="fetch-status-text">{fetchStatus}</p>
        </div>
      )}

      {loading && !fetchingRef && <Spinner />}

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
