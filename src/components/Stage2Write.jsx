import { useState } from 'react';
import { callLLM } from '../api/llm.js';
import { WRITE_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';
import OutputBox from './OutputBox.jsx';
import CopyButton from './CopyButton.jsx';

export default function Stage2Write({ provider, apiKey, stage1Inputs, mode, rubricFeedback, onComplete, onBack }) {
  const { title, primaryKeyword, secondaryKeywords, targetAudience, styleReference, brief } = stage1Inputs;
  const [loading, setLoading] = useState(false);
  const [blogOutput, setBlogOutput] = useState('');
  const [error, setError] = useState('');

  // Auto-run if coming back from Stage 3 with feedback
  const isFixMode = mode === 'fix';

  async function handleWrite() {
    setError('');
    setBlogOutput('');
    setLoading(true);

    let userMessage;
    if (isFixMode) {
      const draftToFix = stage1Inputs.previousBlog || '';
      userMessage = `Blog Draft: ${draftToFix} | Rubric Feedback: ${rubricFeedback} | MODE: FIX`;
    } else {
      const styleBlock = styleReference
        ? ` | Style Reference Blog (analyse before writing): ${styleReference}`
        : '';
      userMessage = `Research Brief: ${brief} | Title: ${title} | Primary Keyword: ${primaryKeyword} | Secondary Keywords: ${secondaryKeywords} | Target audience: ${targetAudience}${styleBlock} | MODE: WRITE`;
    }

    try {
      const result = await callLLM(provider, apiKey, WRITE_SYSTEM_PROMPT, userMessage);
      setBlogOutput(result);
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleEvaluate() {
    onComplete({ blogOutput });
  }

  return (
    <section className="stage-section">
      <h2 className="stage-title">Stage 2: Write</h2>

      <div className="meta-strip">
        <span className="meta-item"><strong>Title:</strong> {title}</span>
        <span className="meta-item"><strong>Keyword:</strong> {primaryKeyword}</span>
        <span className="meta-item"><strong>Audience:</strong> {targetAudience}</span>
      </div>

      {isFixMode && rubricFeedback && (
        <div className="feedback-box">
          <h3 className="feedback-label">Rubric Feedback</h3>
          <pre className="feedback-content">{rubricFeedback}</pre>
        </div>
      )}

      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={handleWrite}
          disabled={loading || !apiKey}
        >
          {isFixMode ? 'Fix Blog' : 'Write Blog'}
        </button>
        {!isFixMode && (
          <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
            Back to Research
          </button>
        )}
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="error-box" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {blogOutput && !loading && (
        <div className="output-section">
          <div className="output-header-row">
            <h3 className="output-label">Blog Output</h3>
            <CopyButton text={blogOutput} label="Copy Full Output" />
          </div>
          <OutputBox content={blogOutput} label="Copy" />
          <div className="action-row">
            <button className="btn btn-primary" onClick={handleEvaluate}>
              Evaluate This Blog
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
