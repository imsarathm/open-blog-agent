import CopyButton from './CopyButton.jsx';

export default function OutputBox({ content, label = 'Copy' }) {
  return (
    <div className="output-box">
      <div className="output-box-header">
        <CopyButton text={content} label={label} />
      </div>
      <pre className="output-content">{content}</pre>
    </div>
  );
}
