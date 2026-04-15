import { useState } from 'react';
import { callLLM } from '../api/llm.js';
import { RESEARCH_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';
import OutputBox from './OutputBox.jsx';

/**
 * Fetches a URL through the allorigins proxy and returns clean plain text.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchRefFromUrl(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('Proxy request failed');

  const json = await res.json();
  if (!json.contents) throw new Error('Empty proxy response');

  const parser = new DOMParser();
  const doc = parser.parseFromString(json.contents, 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, footer, header, aside').forEach((el) =>
    el.remove()
  );

  const text = (doc.body?.innerText || doc.body?.textContent || '').trim();
  if (!text) throw new Error('No readable text found at this URL');
  return text;
}

export default function Stage1Research({ provider, apiKey, onComplete }) {
  const [title, setTitle] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [styleReference, setStyleReference] = useState('');
  const [fetchingRef, setFetchingRef] = useState(false);
  const [refetchError, setRefetchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');

  const isBusy = fetchingRef || loading;

  async function handleResearch(e) {
    e.preventDefault();
    setError('');
    setRefetchError('');
    setBrief('');

    let resolvedRef = styleReference;

    if (refUrl.trim()) {
      setFetchingRef(true);
      try {
        resolvedRef = await fetchRefFromUrl(refUrl.trim());
      } catch {
        setRefetchError('Could not fetch this URL. Please paste the blog text directly instead.');
        setFetchingRef(false);
        return;
      }
      setFetchingRef(false);
    }

    setLoading(true);
    const userMessage = `Title: ${title} | Primary keyword: ${primaryKeyword} | Secondary keywords: ${secondaryKeywords} | Target audience: ${targetAudience}`;

    try {
      const result = await callLLM(provider, apiKey, RESEARCH_SYSTEM_PROMPT, userMessage);
      setBrief(result);
      // Stash resolved ref so handleProceed always has the fetched text
      setStyleReference(resolvedRef);
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleProceed() {
    onComplete({ title, primaryKeyword, secondaryKeywords, targetAudience, styleReference, brief });
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
          <label>Reference blog for style</label>
          <small className="field-hint">
            Agent will match its length, structure, and tone. Provide a URL or paste the text — one is enough.
          </small>

          <input
            id="ref-url"
            type="url"
            value={refUrl}
            onChange={(e) => {
              setRefUrl(e.target.value);
              setRefetchError('');
            }}
            placeholder="https://example.com/blog-post"
            disabled={isBusy}
            className="ref-url-input"
          />

          {refetchError && (
            <p className="ref-fetch-error" role="alert">{refetchError}</p>
          )}

          <div className="ref-or-divider">
            <span>or paste below</span>
          </div>

          <textarea
            id="style-reference"
            value={styleReference}
            onChange={(e) => setStyleReference(e.target.value)}
            placeholder="Paste reference blog text here..."
            rows={8}
            disabled={isBusy}
          />
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
          <p className="fetch-status-text">Fetching reference blog...</p>
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
