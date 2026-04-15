import { useState } from 'react';
import ProgressBar from './components/ProgressBar.jsx';
import Stage1Research from './components/Stage1Research.jsx';
import Stage2Write from './components/Stage2Write.jsx';
import Stage3Evaluate from './components/Stage3Evaluate.jsx';
import { PROVIDERS } from './api/llm.js';
import './App.css';

const STORAGE_KEY_PROVIDER = 'open_blog_agent_provider';
const STORAGE_KEY_API_KEY = 'open_blog_agent_api_key';

function ProviderSelector({ provider, apiKey, onProviderChange, onApiKeyChange }) {
  const [visible, setVisible] = useState(false);
  const config = PROVIDERS[provider];

  return (
    <div className="api-key-section">
      <div className="api-key-row">
        <label htmlFor="provider-select" className="api-key-label">
          AI Provider
        </label>
        <select
          id="provider-select"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className="provider-select"
        >
          {Object.entries(PROVIDERS).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      <div className="api-key-row">
        <label htmlFor="api-key" className="api-key-label">
          API Key
        </label>
        <div className="api-key-input-wrapper">
          <input
            id="api-key"
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={`Paste your ${config.label} key`}
            className="api-key-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="toggle-visibility-btn"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide API key' : 'Show API key'}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <p className="api-key-hint">{config.hint}</p>
    </div>
  );
}

export default function App() {
  const [provider, setProvider] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PROVIDER);
    return stored && PROVIDERS[stored] ? stored : 'groq';
  });
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(STORAGE_KEY_API_KEY) || ''
  );
  const [currentStage, setCurrentStage] = useState(1);
  const [stage1Inputs, setStage1Inputs] = useState(null);
  const [blogOutput, setBlogOutput] = useState('');
  const [stage2Mode, setStage2Mode] = useState('write');
  const [rubricFeedback, setRubricFeedback] = useState('');

  function handleProviderChange(newProvider) {
    setProvider(newProvider);
    localStorage.setItem(STORAGE_KEY_PROVIDER, newProvider);
    // Clear key when switching providers to avoid cross-provider key confusion
    setApiKey('');
    localStorage.setItem(STORAGE_KEY_API_KEY, '');
  }

  function handleApiKeyChange(key) {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY_API_KEY, key);
  }

  function handleStage1Complete(inputs) {
    setStage1Inputs(inputs);
    setStage2Mode('write');
    setRubricFeedback('');
    setCurrentStage(2);
  }

  function handleStage2Complete({ blogOutput: output }) {
    setBlogOutput(output);
    setCurrentStage(3);
  }

  function handleGoBackToResearch() {
    setCurrentStage(1);
  }

  function handleFixBlog({ rubricFeedback: feedback, previousBlog }) {
    setRubricFeedback(feedback);
    setStage1Inputs((prev) => ({ ...prev, previousBlog }));
    setStage2Mode('fix');
    setCurrentStage(2);
  }

  function handleReset() {
    setCurrentStage(1);
    setStage1Inputs(null);
    setBlogOutput('');
    setStage2Mode('write');
    setRubricFeedback('');
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="wordmark">
            <span className="wordmark-open">OPEN</span>
            <span className="wordmark-blog"> Blog Agent</span>
          </div>
          <p className="app-tagline">Research, write, and evaluate enterprise finance content</p>
        </div>
        <ProviderSelector
          provider={provider}
          apiKey={apiKey}
          onProviderChange={handleProviderChange}
          onApiKeyChange={handleApiKeyChange}
        />
      </header>

      <ProgressBar currentStage={currentStage} />

      <main className="app-main">
        {currentStage === 1 && (
          <Stage1Research provider={provider} apiKey={apiKey} onComplete={handleStage1Complete} />
        )}

        {currentStage === 2 && stage1Inputs && (
          <Stage2Write
            provider={provider}
            apiKey={apiKey}
            stage1Inputs={stage1Inputs}
            mode={stage2Mode}
            rubricFeedback={rubricFeedback}
            onComplete={handleStage2Complete}
            onBack={handleGoBackToResearch}
          />
        )}

        {currentStage === 3 && (
          <Stage3Evaluate
            provider={provider}
            apiKey={apiKey}
            blogOutput={blogOutput}
            stage1Inputs={stage1Inputs}
            onFix={handleFixBlog}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>OPEN Blog Agent — powered by {PROVIDERS[provider]?.label}</p>
      </footer>
    </div>
  );
}
