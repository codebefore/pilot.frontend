export type StepState = "done" | "active" | "error" | "pending";

export type Step = {
  title: string;
  state: StepState;
  detail?: string;
};

type StepTrackerProps = {
  steps: Step[];
};

const DOT_GLYPH: Record<StepState, string> = {
  done:    "✓",
  active:  "•",
  error:   "!",
  pending: "",
};

const DOT_CLASS: Record<StepState, string> = {
  done:    "step-dot done",
  active:  "step-dot active",
  error:   "step-dot error",
  pending: "step-dot",
};

const DETAIL_CLASS: Record<StepState, string> = {
  done:    "step-detail",
  active:  "step-detail",
  error:   "step-detail error",
  pending: "step-detail muted",
};

export function StepTracker({ steps }: StepTrackerProps) {
  return (
    <div className="step-tracker">
      {steps.map((step, i) => (
        <div className="step-item" key={i}>
          <div className={DOT_CLASS[step.state]}>{DOT_GLYPH[step.state]}</div>
          <div className={step.state === "done" ? "step-text done" : "step-text"}>
            <strong>{step.title}</strong>
            {step.detail && <span className={DETAIL_CLASS[step.state]}>{step.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
