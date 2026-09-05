const DIMENSIONS = [
  "Problem clarity",
  "Market size",
  "Differentiation",
  "Technical feasibility",
  "Monetisation fit",
  "Speed to test",
];

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function text(value, label, max = 2000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be text`);
  return value.trim().slice(0, max);
}

function integer(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be ${min}-${max}`);
  return number;
}

function exactArray(value, label, length) {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`${label} must contain ${length} items`);
  return value;
}

export function parseOverview(value) {
  const input = object(value, "Overview");
  return {
    ideaName: text(input.ideaName, "ideaName", 160),
    tagline: text(input.tagline, "tagline", 240),
    problem: text(input.problem, "problem"),
    solution: text(input.solution, "solution"),
    differentiation: text(input.differentiation, "differentiation"),
  };
}

export function parseAssumptions(value) {
  const input = object(value, "Assumptions response");
  return {
    assumptions: exactArray(input.assumptions, "assumptions", 4).map((item, index) => {
      const row = object(item, `assumptions[${index}]`);
      const risk = text(row.risk, `assumptions[${index}].risk`, 10).toLowerCase();
      if (!["low", "medium", "high"].includes(risk)) throw new Error(`assumptions[${index}].risk is invalid`);
      return {
        label: text(row.label, `assumptions[${index}].label`, 160),
        assumption: text(row.assumption, `assumptions[${index}].assumption`),
        risk,
        evidence: text(row.evidence, `assumptions[${index}].evidence`),
      };
    }),
    validationSteps: exactArray(input.validationSteps, "validationSteps", 4).map((item, index) => {
      const row = object(item, `validationSteps[${index}]`);
      const priority = text(row.priority, `validationSteps[${index}].priority`, 10).toLowerCase();
      if (!["high", "medium"].includes(priority)) throw new Error(`validationSteps[${index}].priority is invalid`);
      return {
        label: text(row.label, `validationSteps[${index}].label`, 160),
        description: text(row.description, `validationSteps[${index}].description`),
        effort: text(row.effort, `validationSteps[${index}].effort`, 120),
        priority,
      };
    }),
  };
}

export function parseVerdict(value) {
  const input = object(value, "Verdict response");
  const scoring = exactArray(input.scoring, "scoring", 6).map((item, index) => {
    const row = object(item, `scoring[${index}]`);
    const name = text(row.name, `scoring[${index}].name`, 80);
    return { name, score: integer(row.score, `scoring[${index}].score`, 1, 10), note: text(row.note, `scoring[${index}].note`) };
  });
  if (new Set(scoring.map(item => item.name)).size !== DIMENSIONS.length || DIMENSIONS.some(name => !scoring.some(item => item.name === name))) {
    throw new Error("scoring dimensions are invalid");
  }
  const verdict = text(input.verdict, "verdict", 10).toUpperCase();
  if (!["GO", "TEST", "KILL"].includes(verdict)) throw new Error("verdict is invalid");
  return {
    scoring,
    verdict,
    confidence: integer(input.confidence, "confidence", 1, 100),
    rationale: text(input.rationale, "rationale"),
    nextSteps: exactArray(input.nextSteps, "nextSteps", 5).map((item, index) => text(item, `nextSteps[${index}]`)),
  };
}

export const MODEL_DIMENSIONS = DIMENSIONS;
