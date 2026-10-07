import React from 'react';

const SHAPES = ['▲', '◆', '●', '■'];
const COLOR_CLASSES = ['red', 'blue', 'yellow', 'green'];

export function AnswerButton({
  index,
  text,
  onClick,
  disabled = false,
  selected = false,
  highlightCorrect = false,
  showText = true,
}) {
  const colorClass = COLOR_CLASSES[index % 4];
  const shape = SHAPES[index % 4];

  return (
    <button
      type="button"
      className={`answer-btn ${colorClass} ${selected ? 'selected' : ''} ${
        highlightCorrect ? 'correct-highlight' : ''
      }`}
      onClick={() => onClick && onClick(index)}
      disabled={disabled}
    >
      <span className="shape-badge">{shape}</span>
      {showText && <span style={{ flex: 1 }}>{text}</span>}
    </button>
  );
}
