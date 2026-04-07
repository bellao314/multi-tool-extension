import './app-box.css'

function AppBox({
  title,
  description,
  label,
  href,
  onClick,
  icon,
  disabled = false,
}) {
  const classes = `app-box${disabled ? ' is-disabled' : ''}`
  const content = (
    <>
      {icon ? <div className="app-box__icon">{icon}</div> : null}
      <div className="app-box__content">
        <h3 className="app-box__title">{title}</h3>
        {description ? <p className="app-box__description">{description}</p> : null}
      </div>
      {label ? <span className="app-box__label">{label}</span> : null}
    </>
  )

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        aria-disabled={disabled}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <button className={classes} type="button" onClick={onClick} disabled={disabled}>
      {content}
    </button>
  )
}

export default AppBox
