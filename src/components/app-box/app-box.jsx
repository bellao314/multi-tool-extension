import './app-box.css'

function AppBox({
  title,
  description,
  href,
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
    </>
  )

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        aria-disabled={disabled}
      >
        {content}
      </a>
    )
  }

  return (
    <button className={classes} type="button" disabled={disabled}>
      {content}
    </button>
  )
}

export default AppBox
