export default function Spinner() {
  return (
    <div className="spinner-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span className="spinner-text">Thinking...</span>
    </div>
  );
}
