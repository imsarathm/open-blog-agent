const STAGES = [
  { number: 1, label: 'Research' },
  { number: 2, label: 'Write' },
  { number: 3, label: 'Evaluate' },
];

export default function ProgressBar({ currentStage }) {
  return (
    <nav className="progress-bar" aria-label="Progress">
      {STAGES.map((stage, index) => {
        const isCompleted = currentStage > stage.number;
        const isActive = currentStage === stage.number;
        return (
          <div key={stage.number} className="progress-step-wrapper">
            <div
              className={[
                'progress-step',
                isCompleted ? 'step-completed' : '',
                isActive ? 'step-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="step-number">{isCompleted ? '✓' : stage.number}</span>
              <span className="step-label">Stage {stage.number}: {stage.label}</span>
            </div>
            {index < STAGES.length - 1 && (
              <div className={`progress-connector ${isCompleted ? 'connector-done' : ''}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
