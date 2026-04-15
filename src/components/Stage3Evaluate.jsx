import { useState } from 'react';
import { callLLM } from '../api/llm.js';
import { EVALUATE_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';
import OutputBox from './OutputBox.jsx';

export default function Stage3Evaluate({ provider, apiKey, blogOutput, stage1Inputs, onFix, onReset }) {
  const { primaryKeyword } = stage1Inputs;
  const [referenceBlog, setReferenceBlog] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState('');
  const [error, setError] = useState('');

  async function handleEvaluate(e) {
    e.preventDefault();
    setError('');
    setEvaluation('');
    setLoading(true);

    const userMessage = `Draft Blog: ${blogOutput} | Reference Blog: ${referenceBlog} | Primary Keyword: ${primaryKeyword}`;

    try {
      const result = await callLLM(provider, apiKey, EVALUATE_SYSTEM_PROMPT, userMessage);
      setEvaluation(result);
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFix() {
    onFix({ rubricFeedback: evaluation, previousBlog: blogOutput });
  }

  const canSubmit = referenceBlog.trim() && apiKey;

  return (
    <section className="stage-section">
      <h2 className="stage-title">Stage 3: Evaluate</h2>
      <p className="stage-description">
        Paste a high-quality reference blog below. The evaluator will score your draft against it.
      </p>

      <form onSubmit={handleEvaluate} className="stage-form" noValidate>
        <div className="form-group">
          <label htmlFor="reference-blog">
            Reference blog <span className="required">*</span>
          </label>
          <small className="field-hint">
            This can be any OPEN Money blog, a competitor blog, or any enterprise finance blog you admire.
          </small>
          <textarea
            id="reference-blog"
            value={referenceBlog}
            onChange={(e) => setReferenceBlog(e.target.value)}
            placeholder="Paste the full text of a reference blog here..."
            rows={12}
            required
            disabled={loading}
          />
        </div>

        {!apiKey && (
          <p className="form-warning">Enter your API key at the top to continue.</p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit || loading}
        >
          Evaluate
        </button>
      </form>

      {loading && <Spinner />}

      {error && (
        <div className="error-box" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {evaluation && !loading && (
        <div className="output-section">
          <h3 className="output-label">Evaluation Results</h3>
          <OutputBox content={evaluation} label="Copy Evaluation" />
          <div className="action-row">
            <button className="btn btn-primary" onClick={handleFix}>
              Fix This Blog
            </button>
            <button className="btn btn-secondary" onClick={onReset}>
              Start New Blog
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
