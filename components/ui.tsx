import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

type ButtonVariant = 'solid' | 'ghost' | 'ochre'

export function Button({
  variant = 'solid',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`ui-button ui-button-${variant} ${className}`.trim()}
    />
  )
}

export function Input({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  id: string
  helperText?: string
  error?: string
}) {
  const helperId = helperText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        className={`ui-input ${error ? 'is-invalid' : ''} ${className}`.trim()}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined}
      />
      {helperText ? <p className="ui-helper" id={helperId}>{helperText}</p> : null}
      {error ? <p className="ui-error" id={errorId}>{error}</p> : null}
    </div>
  )
}

export function Select({
  label,
  helperText,
  error,
  id,
  className = '',
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string
  id: string
  helperText?: string
  error?: string
  children: ReactNode
}) {
  const helperId = helperText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={id}>{label}</label>
      <select
        {...props}
        id={id}
        className={`ui-select ${error ? 'is-invalid' : ''} ${className}`.trim()}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </select>
      {helperText ? <p className="ui-helper" id={helperId}>{helperText}</p> : null}
      {error ? <p className="ui-error" id={errorId}>{error}</p> : null}
    </div>
  )
}

export function CheckboxChip({
  children,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className={`ui-checkbox-chip ${className}`.trim()}>
      <input type="checkbox" {...props} />
      <span>{children}</span>
    </label>
  )
}

export function Card({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`ui-card ${className}`.trim()} />
}

export function PageShell({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`page-shell ${className}`.trim()}>
      {children}
    </div>
  )
}

export function Prose({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`prose-content ${className}`.trim()} />
}
