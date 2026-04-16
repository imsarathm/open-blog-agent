import { useState } from 'react';
import { callLLM } from '../api/llm.js';
import { FACT_CHECK_SYSTEM_PROMPT } from '../prompts.js';
import Spinner from './Spinner.jsx';

const SECTION_TYPES = {
  'FACT CHECK REPORT': 'title',
  'VERIFIED CLAIMS:': 'verified',
  'UNVERIFIED CLAIMS:': 'unverified',
  'FALSE OR MISLEADING:': 'false',
  'OVERALL RISK:': 'risk',
  'RECOMMENDATION:': 'recommendation',
};

const RISK_CLASS = { LOW: 'risk-low', MEDIUM: 'risk-medium', HIGH: 'risk-high' };

/**
 * Parses the raw fact check text into typed sections.
 * @param {string} text
 * @returns {{ type: string, lines: string[] }[]}
 */
function parseReport(text) {
  const sections = [];
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const header = Object.keys(SECTION_TYPES).find((h) => line.trimStart().startsWith(h));

    if (header) {
      if (current) sections.push(current);
      current = { type: SECTION_TYPES[header], lines: [line.trim()] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function FactCheckReport({ text }) {
  const sections = parseReport(text);

  if (!sections.length) {
    return <pre className="fact-raw">{text}</pre>;
  }

  return (
    <div className="fact-report">
      {sections.map((section, i) => {
        const headerLine = section.lines[0];
        const bodyLines = section.lines.slice(1).filter((l) => l.trim());

        if (section.type === 'title') {
          return <h3 key={i} className="fact-report-title">{headerLine}</h3>;
        }

        if (section.type === 'risk') {
          const riskValue = headerLine.replace('OVERALL RISK:', '').trim();
          const riskClass = RISK_CLASS[riskValue] || '';
          return (
            <div key={i} className={`fact-section fact-section-risk ${riskClass}`}>
              <strong>OVERALL RISK: </strong>
              <span className="risk-value">{riskValue}</span>
            </div>
          );
        }

        const sectionClass = {
          verified: 'fact-section-verified',
          unverified: 'fact-section-unverified',
          false: 'fact-section-false',
          recommendation: 'fact-section-recommendation',
        }[section.type] || '';

        return (
          <div key={i} className={`fact-section ${sectionClass}`}>
            <p className="fact-section-header">{headerLine}</p>
            {bodyLines.map((line, j) => (
              <p key={j} className="fact-claim">{line}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function Stage3FactCheck({ provider, apiKey, blogOutput, onFix, onEvaluate }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  async function handleCheck() {
    setError('');
    setReport('');
    setLoading(true);
    try {
      const result = await callLLM(provider, apiKey, FACT_CHECK_SYSTEM_PROMPT, blogOutput);
      setReport(result);
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFix() {
    onFix({ rubricFeedback: report, previousBlog: blogOutput });
  }

  return (
    <section className="stage-section">
      <h2 className="stage-title">Stage 3: Fact Check</h2>
      <p className="stage-description">
        The fact checker will extract every claim and verify it before you publish.
      </p>

      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={loading || !apiKey}
        >
          Check Facts
        </button>
      </div>

      {loading && <Spinner />}

      {error && (
        <div className="error-box" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && !loading && (
        <div className="output-section">
          <FactCheckReport text={report} />
          <div className="action-row" style={{ marginTop: '24px' }}>
            <button className="btn btn-danger" onClick={handleFix}>
              Fix in Writer
            </button>
            <button className="btn btn-primary" onClick={onEvaluate}>
              Looks Good, Evaluate
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
