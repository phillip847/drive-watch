import '../styles/plate.css';

// Namibian number plate. Stays white with black text in dark mode, like the real plate.
export default function Plate({ reg, size = 'md' }) {
  return (
    <span className={`plate plate--${size}`} aria-label={`Registration ${reg}`}>
      {reg}
    </span>
  );
}
