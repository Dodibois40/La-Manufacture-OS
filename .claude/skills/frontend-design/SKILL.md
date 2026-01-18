# Frontend Design Skill

## Theme: iOS Dark Mode

La Manufacture OS utilise un theme inspire d'iOS en mode sombre.

## Palette de couleurs

```css
:root {
  /* Backgrounds */
  --bg-primary: #1c1c1e;
  --bg-secondary: #2c2c2e;
  --bg-tertiary: #3a3a3c;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #8e8e93;
  --text-tertiary: #636366;

  /* Accents */
  --accent: #0a84ff;
  --accent-hover: #409cff;
  --success: #30d158;
  --warning: #ff9f0a;
  --error: #ff453a;

  /* Borders */
  --border: rgba(255, 255, 255, 0.1);
}
```

## Composants UI

### Cards

```css
.card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border);
}
```

### Buttons

```css
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Inputs

```css
.input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  color: var(--text-primary);
}

.input:focus {
  border-color: var(--accent);
  outline: none;
}
```

## Responsive

```css
/* Mobile first */
.container {
  padding: 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

## Animations

```css
/* Transitions douces */
.element {
  transition: all 0.2s ease;
}

/* Hover subtil */
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```
